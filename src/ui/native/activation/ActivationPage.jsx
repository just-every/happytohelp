import React from 'react';
import AiSpendCard from '../activation-spend/AiSpendCard';
import ActivationChecklist from './ActivationChecklist';
export default function ActivationPage({projectId}) {
 return <div className="activation-overview"><ActivationChecklist projectId={projectId}/><AiSpendCard projectId={projectId}/></div>;
}
