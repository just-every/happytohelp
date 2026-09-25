// Rate limits count in fixed UTC-aligned windows (src/platform/usage-counters.ts), and a
// count resets at each boundary. A burst that asserts exactly which request is refused
// must therefore not straddle a boundary: call this before the burst with the length of
// the shortest window it exercises and the time the burst needs. Hour and day boundaries
// are also minute boundaries, so the minute guard covers every window a burst touches.
export async function awaitWindowRoom(seconds,needMs){
 const length=seconds*1000
 if(needMs>=length)throw new Error(`a ${needMs} ms burst cannot fit a ${seconds} s window`)
 const left=length-Date.now()%length
 if(left<needMs)await new Promise(resolve=>setTimeout(resolve,left+50))
}
