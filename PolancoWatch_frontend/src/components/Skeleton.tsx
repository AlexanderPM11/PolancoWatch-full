import React from 'react';

interface SkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    circle?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', width, height, circle }) => {
    return (
        <div 
            className={`skeleton ${circle ? 'rounded-full' : 'rounded-lg'} ${className}`}
            style={{ 
                width: width || '100%', 
                height: height || '1rem' 
            }}
        />
    );
};
