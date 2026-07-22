'use client';

import React from 'react';
import { ECONOMIC_EVENTS, getEventTimeLeft } from '@/lib/economic-calendar';

interface EconomicCalendarProps {
    onClose: () => void;
}

export default function EconomicCalendar({ onClose }: EconomicCalendarProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="glass-panel w-full max-w-4xl max-h-[85vh] flex flex-col border border-[var(--card-border)] rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--card-border)] flex items-center justify-between bg-[#12161d]">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📅</span>
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                経済指標・重要イベントカレンダー
                            </h2>
                            <p className="text-xs text-[var(--text-secondary)] font-mono">
                                Economic Calendar & Central Bank Schedules
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10 text-xl font-bold"
                    >
                        ✕
                    </button>
                </div>

                {/* Content Table */}
                <div className="p-6 overflow-y-auto space-y-4">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs font-sans">
                            <thead>
                                <tr className="border-b border-[var(--card-border)] text-[var(--text-secondary)] font-mono text-[11px] uppercase tracking-wider">
                                    <th className="pb-3 px-3">日時 (JST)</th>
                                    <th className="pb-3 px-3">国</th>
                                    <th className="pb-3 px-3">重要度</th>
                                    <th className="pb-3 px-3">指標 / イベント</th>
                                    <th className="pb-3 px-3 text-right">前回値</th>
                                    <th className="pb-3 px-3 text-right">予想値</th>
                                    <th className="pb-3 px-3 text-right">結果値</th>
                                    <th className="pb-3 px-3 text-center">カウントダウン</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--card-border)]/50">
                                {ECONOMIC_EVENTS.map((item) => {
                                    const timeLeft = getEventTimeLeft(item.date, item.time);
                                    const isHigh = item.importance === 'high';
                                    const isToday = timeLeft.includes('時間') || timeLeft.includes('分') || timeLeft.includes('対応中');

                                    return (
                                        <tr
                                            key={item.id}
                                            className={`hover:bg-white/[0.02] transition-colors ${
                                                isToday ? 'bg-amber-500/10' : ''
                                            }`}
                                        >
                                            {/* 日時 */}
                                            <td className="py-3 px-3 whitespace-nowrap font-mono">
                                                <div className="font-semibold text-gray-200">{item.date}</div>
                                                <div className="text-[11px] text-[var(--text-secondary)]">{item.time}</div>
                                            </td>

                                            {/* 国 */}
                                            <td className="py-3 px-3 whitespace-nowrap font-medium text-gray-300">
                                                <span className="text-base mr-1">{item.flag}</span>
                                                {item.countryName}
                                            </td>

                                            {/* 重要度 */}
                                            <td className="py-3 px-3 whitespace-nowrap">
                                                {isHigh ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 w-fit">
                                                        🔥 HIGH
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1 w-fit">
                                                        📊 MEDIUM
                                                    </span>
                                                )}
                                            </td>

                                            {/* 指標名 */}
                                            <td className="py-3 px-3 font-semibold text-gray-100">
                                                {item.event}
                                            </td>

                                            {/* 前回値 */}
                                            <td className="py-3 px-3 text-right font-mono text-gray-400">
                                                {item.previous}
                                            </td>

                                            {/* 予想値 */}
                                            <td className="py-3 px-3 text-right font-mono text-amber-300 font-semibold">
                                                {item.forecast}
                                            </td>

                                            {/* 結果値 */}
                                            <td className="py-3 px-3 text-right font-mono font-bold text-green-400">
                                                {item.actual || '—'}
                                            </td>

                                            {/* カウントダウン */}
                                            <td className="py-3 px-3 text-center whitespace-nowrap font-mono">
                                                <span
                                                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                                        isToday
                                                            ? 'bg-amber-500 text-black animate-pulse font-bold'
                                                            : 'bg-[var(--card-bg-hover)] text-gray-300 border border-[var(--card-border)]'
                                                    }`}
                                                >
                                                    {timeLeft}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-[var(--card-border)] bg-[#12161d] flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
                    <span>時刻表示: 日本標準時 (JST)</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-lg bg-[var(--card-bg-hover)] text-gray-200 border border-[var(--card-border)] hover:bg-white/10 transition-colors font-semibold"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}
