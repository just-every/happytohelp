// Queue config for the isolated emitted-Worker runtimes. Producers always stay so code that
// enqueues still works; the real consumer starts only when a runtime asks for it (or the run sets
// H2H_TEST_QUEUE_CONSUMERS=1), because a job a test leaves on the queue is then delivered mid-test (gr-base-215).
export function isolatedQueues({consumers=process.env.H2H_TEST_QUEUE_CONSUMERS==='1'}={}){
 return {producers:[{binding:'JOBS',queue:'isolated-jobs'}],...(consumers?{consumers:[{queue:'isolated-jobs',max_batch_size:1,max_retries:0}]}:{})}
}
