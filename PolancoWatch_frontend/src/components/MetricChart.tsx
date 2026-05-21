import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DataPoint {
    timestamp: Date;
    value: number;
}

interface MetricChartProps {
    data: DataPoint[];
    color: string;
    domain?: [number, number] | ['auto', 'auto'];
    formatter?: (value: number) => string;
}

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-obsidian-900/90 backdrop-blur-md border border-white/10 rounded-lg p-2 px-3 shadow-2xl pointer-events-none animate-in fade-in zoom-in duration-200">
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black font-mono text-white leading-none">
                        {formatter(payload[0].value)}
                    </span>
                    <span className="text-[7px] font-black font-mono text-slate-500 uppercase tracking-widest mt-1.5 border-t border-white/5 pt-1 w-full text-center">
                        {format(new Date(label), "d MMM yyyy, HH:mm:ss", { locale: es })}
                    </span>
                </div>
            </div>
        );
    }
    return null;
};

export function MetricChart({ data, color, domain = [0, 100], formatter = (val) => `${val}%` }: MetricChartProps) {
    const gradientId = `color-${color.replace('#', '')}`;

    return (
        <div className="h-full w-full overflow-visible">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 0, left: -30, bottom: 0 }}>
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                            <stop offset="95%" stopColor={color} stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff" opacity={0.05} />
                    <XAxis 
                        dataKey="timestamp" 
                        hide={true}
                    />
                    <YAxis 
                        domain={domain} 
                        tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono' }}
                        tickFormatter={formatter}
                        axisLine={false}
                        tickLine={false}
                        width={30}
                        ticks={[0, 50, 100]}
                    />
                    <Tooltip
                        content={<CustomTooltip formatter={formatter} />}
                        position={{ y: 65 }}
                        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={color} 
                        strokeWidth={2.5} 
                        fillOpacity={1} 
                        fill={`url(#${gradientId})`}
                        isAnimationActive={false}
                        activeDot={{ r: 5, fill: color, stroke: '#05070a', strokeWidth: 3 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
