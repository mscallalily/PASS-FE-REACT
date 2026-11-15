import { apiRequest } from './apiClient';

const idleMessage = 'Parking guidance and authorized miniature gate commands use the gate PC. Check Hardware & Station for current availability.';
const decisions = new Set(['granted', 'completed', 'denied', 'already_inside', 'not_inside', 'not_found', 'full']);
const statusValues = new Set(['pending', 'claimed', 'acknowledged', 'expired', 'unconfirmed', 'failed']);

export class StaffBarrier {
  constructor(getStatus = id => apiRequest('/api/parking/barrier-commands/' + id)) {
    this.getStatus=getStatus;this.listeners=new Set();this.operation=null;this.generation=0;this.identity=null;
    this.state={busy:false,pending:false,reviewing:false,notice:false,message:idleMessage};
  }
  snapshot=()=>this.state;
  subscribe=listener=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  update(change){this.state={...this.state,...change};this.listeners.forEach(fn=>fn());}
  reset(){this.generation++;this.operation=null;this.update({busy:false,pending:false,reviewing:false,notice:false,message:idleMessage});}
  identify(identity){if(identity!==this.identity){this.identity=identity;this.reset();}}
  dismiss(){if(!this.state.busy&&!this.state.pending&&!this.state.reviewing)this.update({notice:false});}
  begin(){
    if(this.state.reviewing)throw new Error('Review the previous uncertain PASS result first.');
    if(this.operation||this.state.busy||this.state.pending)throw new Error('Wait for the current gate action.');
    this.generation++;
    const ticket=Object.freeze({generation:this.generation});this.operation=ticket;this.update({busy:true,notice:true,message:'Waiting for PASS to confirm the action...'});return ticket;
  }
  async approved(ticket,decision){
    if(ticket!==this.operation)return{opened:false,message:'This gate action was already handled.'};
    const normalEntryExit = decision?.kind === 'parking' || decision?.kind === 'visitor';
    const allowed=normalEntryExit?((decision.direction==='entry'&&decision.status==='granted')||(decision.direction==='exit'&&decision.status==='completed')):
      decision?.kind==='emergency'&&decision.action==='release'&&decision.status==='completed'&&decision.gate_action==='open'&&Number(decision.release_id)===Number(decision.expected_release_id);
    this.operation=null;
    if ((!allowed && (decision?.barrier_status === 'pending' || normalEntryExit && !decisions.has(decision.status))) ||
        (allowed && decision.barrier_status !== 'pending' && (!['unavailable', 'not_requested'].includes(decision.barrier_status) || decision.barrier_command_id !== null))) {
      const message = 'PASS returned an incomplete gate result. Check access records and the gate operator before another transaction.';
      this.update({busy:false,pending:false,reviewing:true,notice:true,message});
      return {opened:false,message};
    }
    if(!allowed){const message='PASS did not approve a new opening. Check the recorded access decision.';this.update({busy:false,notice:true,message});return{opened:false,denied:true,message};}
    const queued=decision.barrier_status==='pending' && Number.isSafeInteger(decision.barrier_command_id) && decision.barrier_command_id>0;
    if (decision.barrier_status === 'pending' && !queued) {
      const message = 'PASS could not confirm the queued command. Check access records and the gate operator before another transaction.';
      this.update({busy:false,pending:false,reviewing:true,notice:true,message});
      return {opened:false,message};
    }
    const message=decision.barrier_status==='unavailable'?'Recorded in PASS. Check Hardware & Station and the gate operator before passage.':queued?'Recorded in PASS. OPEN is queued for the gate PC.':'Recorded in PASS. Check with the gate operator before passage.';
    this.update({busy:false,pending:queued,notice:true,message});
    if(queued)void this.observe(decision.barrier_command_id,ticket.generation);
    return{opened:false,queued,disabled:decision.barrier_status==='unavailable',message};
  }
  async observe(id,generation){
    for(let attempt=0;attempt<20 && generation===this.generation;attempt++){
      try {
        const result=await this.getStatus(id);
        if(generation!==this.generation)return;
        if(result?.command_id!==id||!statusValues.has(result.status))throw new Error('Unexpected command response.');
        if(result.status==='acknowledged'){this.update({pending:false,notice:true,message:'OPEN command acknowledged by the gate PC. Visually check the miniature gate before passage.'});return;}
        if(['expired','unconfirmed','failed'].includes(result.status)){this.update({pending:false,notice:true,reviewing:true,message:'The action is recorded in PASS. Check the access record and gate operator before another transaction.'});return;}
      }catch{if(generation===this.generation)this.update({pending:false,notice:true,reviewing:true,message:'Hardware status is unavailable. Check access records and the gate operator before another transaction.'});return;}
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    if(generation===this.generation)this.update({pending:false,notice:true,reviewing:true,message:'Hardware confirmation timed out. Check access records and the gate operator.'});
  }
  failed(ticket,error){if(ticket!==this.operation)return;const status=Number(error?.status),uncertain=!status||status>=500||error?.code==='invalid_response'||error?.code==='request_timeout';this.update({notice:true,reviewing:this.state.reviewing||uncertain,message:uncertain?'PASS may have saved the action. Check access records and the gate operator before another transaction.':'PASS rejected the action. Check the reported reason.'});}
  finish(ticket){if(ticket===this.operation){this.operation=null;this.update({busy:false});}}
  reviewed(){if(this.state.reviewing&&!this.state.busy&&!this.state.pending&&!this.operation)this.update({notice:true,reviewing:false,message:'Access-record review confirmed. Check Hardware & Station for gate availability and any required physical review.'});}
}
export const staffBarrier=new StaffBarrier();
