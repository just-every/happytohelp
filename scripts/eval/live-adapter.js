'use strict';
const {runCase}=require('./native-client');
const NAMESPACE='happytohelp.synthetic-eval.v1';
const CUSTOMER_REPLY_EVALUATION_CASE_IDS=['completed_refund_note','unconfirmed_refund','policy_beyond_130_files','long_thread_older_fact','internal_only_note','spanish_missing_order'];
module.exports={NAMESPACE,CUSTOMER_REPLY_EVALUATION_CASE_IDS,runVariant:runCase,runCustomerReplyVariant:input=>runCase({...input,caseDefinition:{...input.caseDefinition,family:'customer_reply'}}),close:async()=>{}};
