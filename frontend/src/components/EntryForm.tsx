import { useState, useEffect } from 'react';
import { addEntry, changePassword } from '../api';
import { Calendar, User, DollarSign, FileText, RefreshCw, Eye, EyeOff } from 'lucide-react';

interface EntryFormProps {
  onEntryAdded?: () => void;
}

export default function EntryForm({ onEntryAdded }: EntryFormProps) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  
  const [date, setDate] = useState(today);
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'借出' | '收回'>('借出');
  const [description, setDescription] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    const handleShowChangePassword = () => setShowChangePassword(true);
    document.addEventListener('show-change-password', handleShowChangePassword);
    return () => document.removeEventListener('show-change-password', handleShowChangePassword);
  }, []);

  const handleSubmit = async () => {
    if (!date || !person || !amount) {
      setMessage('日期、人物和金额不能为空');
      setMessageType('error');
      return;
    }

    if (date.length !== 8 || !/^\d+$/.test(date)) {
      setMessage('日期格式不正确，应为YYYYMMDD');
      setMessageType('error');
      return;
    }

    const amountNum = parseInt(amount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      setMessage('金额必须是正整数');
      setMessageType('error');
      return;
    }

    try {
      const result = await addEntry({
        date,
        person,
        description,
        amount: amountNum,
        type,
      });

      if (result.success) {
        setMessage(result.message);
        setMessageType('success');
        clearForm();
        onEntryAdded?.();
      } else {
        setMessage(result.message || '添加失败');
        setMessageType('error');
      }
    } catch {
      setMessage('网络错误，请稍后重试');
      setMessageType('error');
    }
  };

  const clearForm = () => {
    setDate(today);
    setPerson('');
    setAmount('');
    setType('借出');
    setDescription('');
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setMessage('请填写完整信息');
      setMessageType('error');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('两次输入的密码不一致');
      setMessageType('error');
      return;
    }

    try {
      const result = await changePassword({ old_password: oldPassword, new_password: newPassword });
      
      if (result.success) {
        setMessage(result.message);
        setMessageType('success');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowChangePassword(false);
      } else {
        setMessage(result.message || '修改失败');
        setMessageType('error');
      }
    } catch {
      setMessage('网络错误，请稍后重试');
      setMessageType('error');
    }
  };

  if (showChangePassword) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6">修改密码</h2>
        
        {message && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            messageType === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
          }`}>
            {message}
          </div>
        )}

        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">当前密码</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="请输入当前密码"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="请输入新密码"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">确认新密码</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="请再次输入新密码"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setShowChangePassword(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              取消
            </button>
            <button
              onClick={handleChangePassword}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              确认修改
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">账目录入</h2>
      
      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
          messageType === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
        }`}>
          {message}
        </div>
      )}

      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">日期 (YYYYMMDD)</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full pl-10 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="YYYYMMDD"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">人物</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              className="w-full pl-10 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="请输入人物姓名"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">金额</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-10 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="请输入金额"
              min="1"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">类型</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={type === '借出'}
                onChange={() => setType('借出')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700">借出</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={type === '收回'}
                onChange={() => setType('收回')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700">收回</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">描述（可选）</label>
          <div className="relative">
            <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full pl-10 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              placeholder="请输入描述信息"
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
          >
            <FileText className="w-5 h-5" />
            添加账目
          </button>
          <button
            onClick={clearForm}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            清空
          </button>
        </div>
      </div>
    </div>
  );
}