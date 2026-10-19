import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import { load } from '@tensorflow-models/coco-ssd';
import type { ObjectDetection } from '@tensorflow-models/coco-ssd';

let model: Promise<ObjectDetection> | null = null;
self.onmessage = async event => {
  let image: tf.Tensor3D | null = null;
  try {
    const { pixels, width, height, modelUrl } = event.data;
    model ??= (async () => {
      await tf.setBackend('cpu'); await tf.ready();
      return load({ base: 'lite_mobilenet_v2', modelUrl });
    })();
    const detector = await model;
    image = tf.tensor3d(new Uint8Array(pixels), [height, width, 3], 'int32');
    const detections = await detector.detect(image, 12, .55);
    self.postMessage({ detections });
  } catch {
    self.postMessage({ error: true });
  } finally { image?.dispose(); }
};
