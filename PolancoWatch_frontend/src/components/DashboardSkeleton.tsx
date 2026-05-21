import React from 'react';
import { Skeleton } from './Skeleton';

export const DashboardSkeleton: React.FC = () => {
    return (
        <div className="animate-fade-in space-y-8">
            {/* System Info Header Skeleton */}
            <div className="glass-panel rounded-4xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 border-glow">
                <div className="flex items-center gap-6">
                    <Skeleton width={64} height={64} className="rounded-2xl" />
                    <div className="space-y-2">
                        <Skeleton width={200} height={32} />
                        <Skeleton width={150} height={20} />
                    </div>
                </div>
                <div className="flex flex-col items-center md:items-end bg-white/10 py-4 px-8 rounded-2xl border border-white/10 min-w-[200px]">
                    <Skeleton width={80} height={12} className="mb-2" />
                    <Skeleton width={120} height={40} />
                </div>
            </div>

            {/* Primary Metrics Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[1, 2].map(i => (
                    <div key={i} className="glass-card rounded-4xl p-8 relative overflow-hidden border-white/5">
                        <div className="space-y-4">
                            <Skeleton width={120} height={12} />
                            <div className="flex items-baseline gap-2">
                                <Skeleton width={80} height={60} />
                                <Skeleton width={20} height={30} />
                            </div>
                            <Skeleton height={96} className="mt-4" />
                        </div>
                    </div>
                ))}
                <div className="glass-card rounded-4xl p-8 relative overflow-hidden group lg:col-span-2 border-white/5">
                    <Skeleton width={150} height={12} className="mb-8" />
                    <div className="grid grid-cols-2 gap-10">
                        {[1, 2].map(j => (
                            <div key={j} className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Skeleton width={8} height={8} circle />
                                    <Skeleton width={60} height={10} />
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <Skeleton width={100} height={50} />
                                    <Skeleton width={40} height={20} />
                                </div>
                                <Skeleton height={80} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Disks List Skeleton */}
                <div className="glass-card rounded-4xl p-8 lg:col-span-2 border-white/5">
                    <div className="flex justify-between items-center mb-8">
                        <Skeleton width={150} height={18} />
                        <Skeleton width={100} height={12} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="p-6 rounded-2xl bg-white/2 border border-white/4">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="space-y-2">
                                        <Skeleton width={60} height={14} />
                                        <Skeleton width={80} height={10} />
                                    </div>
                                    <Skeleton width={50} height={30} />
                                </div>
                                <Skeleton height={8} className="rounded-full" />
                                <div className="flex justify-between mt-4">
                                    <Skeleton width={80} height={10} />
                                    <Skeleton width={80} height={10} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Alerts Skeleton */}
                <div className="glass-card rounded-4xl p-8 border-white/5">
                    <Skeleton width={120} height={18} className="mb-8" />
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                            <Skeleton key={i} height={60} className="rounded-xl" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
