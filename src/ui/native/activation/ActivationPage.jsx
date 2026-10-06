import React from 'react';
import ActivationChecklist from './ActivationChecklist';
export default function ActivationPage({projectId}) {
 return <div className="activation-overview"><ActivationChecklist projectId={projectId}/></div>;
}
