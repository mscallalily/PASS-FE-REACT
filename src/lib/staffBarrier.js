import { apiRequest } from './apiClient';

// PASS_AUTOMATIC_BARRIER_V3: business actions never depend on a browser hardware connection.
export class StaffBarrier {
  constructor(getStatus = id => apiRequest('/api/parking/barrier-commands/' + id)) {
    this.getStatus=getStatus;this.listeners=new Set();this.operation=null;this.generation=0;
    this.state={busy:false,reviewing:false,message:'Parking guidance is active. Servo disconnected; automatic barrier opening is disabled.'};
  }
  snapshot=()=>this.state;
  subscribe=listener=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  update(change){this.state={...this.state,...change};this.listeners.forEach(fn=>fn());}
  begin(){
    if(this.state.reviewing)throw new Error('Review the previous uncertain PASS result first.');
    if(this.operation||this.state.busy)throw new Error('Wait for the current gate action.');
    this.generation++;
    const ticket=Object.freeze({generation:this.generation});this.operation=ticket;this.update({busy:true,message:'Waiting for PASS to confirm the action...'});return ticket;
  }
  async approved(ticket,decision){
    if(ticket!==this.operation)return{opened:false,message:'This gate action was already handled.'};
    const allowed=decision?.kind==='visitor'?((decision.direction==='entry'&&decision.status==='granted')||(decision.direction==='exit'&&decision.status==='completed')):
      decision?.kind==='emergency'&&decision.action==='release'&&decision.status==='completed'&&decision.gate_action==='open'&&Number(decision.release_id)===Number(decision.expected_release_id);
    this.operation=null;
    if(!allowed){const message='PASS did not approve a new opening. Barrier unchanged.';this.update({busy:false,message});return{opened:false,denied:true,message};}
    const queued=decision.barrier_status==='pending' && Number.isSafeInteger(decision.barrier_command_id) && decision.barrier_command_id>0;
    // PASS_PARKING_STATION_V1
    const message=decision.barrier_status==='unavailable'?'Recorded in PASS. Servo disconnected; automatic barrier opening is disabled.':queued?'Recorded in PASS. Automatic barrier opening requested; waiting for the gate PC.':'Recorded in PASS. Barrier opening was not queued; the system action is complete.';
    this.update({busy:false,message});
    if(queued)void this.observe(decision.barrier_command_id,ticket.generation);
    return{opened:false,queued,disabled:decision.barrier_status==='unavailable',message};
  }
  async observe(id,generation){
    for(let attempt=0;attempt<20 && generation===this.generation;attempt++){
      try {
        const result=await this.getStatus(id);
        if(generation!==this.generation)return;
        if(result.status==='acknowledged'){this.update({message:'Automatic OPEN acknowledged by the gate PC. Check the physical barrier and passage.'});return;}
        if(['expired','unconfirmed','failed'].includes(result.status)){this.update({message:'Recorded in PASS; barrier opening not confirmed. The gate PC may be unavailable. Do not repeat this recorded transaction.'});return;}
      }catch{if(generation===this.generation)this.update({message:'Recorded in PASS; hardware status is unavailable. Barrier opening is not confirmed.'});return;}
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    if(generation===this.generation)this.update({message:'Recorded in PASS; barrier opening not confirmed. Check the gate controller.'});
  }
  failed(ticket,error){if(ticket!==this.operation)return;const status=Number(error?.status),uncertain=!status||status>=500;this.update({reviewing:this.state.reviewing||uncertain,message:uncertain?'PASS result is uncertain. Check access records before repeating the transaction.':'PASS rejected the action. No opening was requested.'});}
  finish(ticket){if(ticket===this.operation){this.operation=null;this.update({busy:false});}}
  reviewed(){if(!this.state.busy&&!this.operation)this.update({reviewing:false,message:'Review confirmed. Servo remains disconnected; the action stays recorded in PASS.'});}
}
export const staffBarrier=new StaffBarrier();
