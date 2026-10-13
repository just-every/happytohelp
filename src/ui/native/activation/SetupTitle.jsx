import useSetup from './useSetup';
import {needs} from './setup-model';

/** The Setup page's heading: "Nearly ready" while anything needs the person (or the snapshot has not arrived), "All set" once nothing does.
 * Skipped items do not need the person, so they never hold it at "Nearly ready". */
export default function SetupTitle({projectId}) {
 const {data}=useSetup(projectId);
 return data&&needs(data).length===0?<span data-setup-state="ready">All set</span>:<span data-setup-state="needs-you">Nearly ready</span>;
}
