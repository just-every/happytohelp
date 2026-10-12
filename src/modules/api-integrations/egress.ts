import {declareEgress} from '../../vendor/base/modules/integrations/egress/index.ts'
/** Manifest declaration only; the edition HTTPS transport applies bounded requests and refuses redirects. */
export const connectionsEgress=declareEgress({
 id:'workspace-connections',required:false,requiredWhen:'Saving or enabling workspace webhook or Slack connections',
 provider:{id:'workspace-receivers',name:'Configured workspace receivers including Slack'},
 destination:{kind:'custom',id:'workspace-connection-version',description:'Owner-selected public HTTPS webhook receivers or the fixed Slack incoming-webhook and chat.postMessage protocols'},
 why:'Customer receivers and Slack are external destinations. Delivery uses platform HTTPS fetch with manual redirects, a finite timeout and byte bounds.',
 dataFields:['Opaque workspace, conversation, message and resolution IDs','Event type, time, revision, outcome and numeric rating','Slack notification with up to 500 characters of the first committed visitor message'],
 adapters:[],
 custody:[{name:'INTEGRATION_ENCRYPTION_KEY',purpose:'Encrypt native stored webhook signing keys and Slack credentials'}]
})
