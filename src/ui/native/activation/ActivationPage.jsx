import React from 'react';
import AiSpendCard from '../activation-spend/AiSpendCard';
import ActivationChecklist from './ActivationChecklist';
export default function ActivationPage({projectId,role}) {
 return <div className="activation-overview"><ActivationChecklist projectId={projectId} role={role}/><AiSpendCard projectId={projectId}/></div>;
}
