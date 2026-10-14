import {loadavg} from 'node:os';
import {setTimeout} from 'node:timers/promises';
import {servingLoadThreshold} from '@runeditrun/rer/server-resources';

// Setup can leave the machine temporarily busy. Admit the test's single public
// server launch without overriding its policy or retrying a refused command.
export async function waitForServingCapacity(env=process.env){
 const threshold=servingLoadThreshold(env),deadline=Date.now()+20*60*1000;
 while(loadavg()[0]>threshold){
  if(Date.now()>=deadline)throw Error('No eligible server startup window within the bounded resource wait');
  console.log('Waiting for server startup capacity under the unchanged Base policy');
  await setTimeout(60_000);
 }
}
