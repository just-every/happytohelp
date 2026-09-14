import React from 'react';

export default function WorkspaceBrandAvatar({ brand }) {
    return (
        <span className="happytohelp-workspace-brand">
            <img src={brand.avatar_url} alt={`${brand.name} brand`} />
        </span>
    );
}
