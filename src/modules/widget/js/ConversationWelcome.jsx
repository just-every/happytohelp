import React, {useContext} from 'react';
import AppContext from './context/AppContext';

export default function ConversationWelcome({empty}) {
 const {brand} = useContext(AppContext);
 return empty && <div className="happytohelp-welcome">
   {brand?.avatar_url && <img src={brand.avatar_url} alt={`${brand.name} support`} />}
   <p>{brand?.greeting || 'Hi! How can we help you today?'}</p>
  </div>;
}
