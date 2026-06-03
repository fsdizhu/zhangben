import { useAuth } from '../context/AuthContext';
import { ViewType } from '../types';
import { 
  PlusCircle, 
  List, 
  FileText, 
  Download, 
  BarChart3, 
  Settings, 
  Users, 
  Lock, 
  LogOut,
  BookOpen
} from 'lucide-react';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const menuItems = [
  { id: 'entry-form' as ViewType, label: '账目录入', icon: PlusCircle },
  { id: 'entry-list' as ViewType, label: '账目列表', icon: List },
  { id: 'parser' as ViewType, label: '文本解析', icon: FileText },
  { id: 'export' as ViewType, label: '数据导出', icon: Download },
  { id: 'stats' as ViewType, label: '统计信息', icon: BarChart3 },
];

const adminMenuItems = [
  { id: 'config' as ViewType, label: '配置管理', icon: Settings },
  { id: 'users' as ViewType, label: '用户管理', icon: Users },
];

const userActions = [
  { id: 'change-password' as const, label: '修改密码', icon: Lock },
  { id: 'logout' as const, label: '退出登录', icon: LogOut },
];

export default function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const { user, logout } = useAuth();

  const handleAction = (action: 'change-password' | 'logout') => {
    if (action === 'logout') {
      if (confirm('确定要退出登录吗？')) {
        logout();
      }
    } else if (action === 'change-password') {
      onViewChange('entry-form');
      document.dispatchEvent(new CustomEvent('show-change-password'));
    }
  };

  return (
    <div className="w-56 bg-gradient-to-b from-gray-800 to-gray-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg">账本管理</h1>
            <p className="text-xs text-gray-400">工具</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">功能菜单</p>
        <div className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                currentView === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {user?.is_super && (
          <>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 mt-6">管理菜单</p>
            <div className="space-y-1">
              {adminMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                    currentView === item.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">用户操作</p>
        <div className="space-y-1">
          {userActions.map((item) => (
            <button
              key={item.id}
              onClick={() => handleAction(item.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition"
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-sm text-gray-400">当前用户: {user?.username}</p>
          {user?.is_super && (
            <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full">超级用户</span>
          )}
        </div>
      </div>
    </div>
  );
}