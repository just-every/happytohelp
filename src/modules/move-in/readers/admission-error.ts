/** A source location contains no source value. Refusals happen before raw custody. */
export class AdmissionError extends Error {
 readonly code:string;readonly artifact:string;readonly row:number;readonly pointer:string
 constructor(code:string,artifact:string,row=1,pointer='',message=code){super(message);this.code=code;this.artifact=artifact;this.row=row;this.pointer=pointer}
 get diagnostic(){return {code:this.code,location:{artifact:this.artifact,row:this.row,pointer:this.pointer}}}
}
export class IndexLimitError extends Error {
 readonly row:number;readonly pointer:string
 constructor(row:number,pointer:string){super('export_record_limit');this.row=row;this.pointer=pointer}
}
