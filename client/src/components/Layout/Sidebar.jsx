import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Sidebar() {
  const location = useLocation();

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const navItems = [
    { path: '/', label: '项目', icon: '📁' },
    { path: '/templates', label: '模板库', icon: '📋' },
    { path: '/resources', label: '资源', icon: '👥' },
  ];

  return (
    <aside className="w-56 bg-slate-800 text-white flex flex-col shrink-0">
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-lg font-bold tracking-tight">Gantt Timeline</h1>
        <p className="text-xs text-slate-400 mt-0.5">临床试验时间表管理器</p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
              isActive(item.path)
                ? 'bg-slate-700 text-white font-medium'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
