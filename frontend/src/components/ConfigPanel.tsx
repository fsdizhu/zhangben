import { useState, useEffect } from 'react';
import { getConfig, updatePresetNames, updateKeywords, updateThreshold } from '../api';
import { Save, RefreshCw, Users, Tag, Gauge } from 'lucide-react';

export default function ConfigPanel() {
  const [presetNames, setPresetNames] = useState('');
  const [lendKeywords, setLendKeywords] = useState('');
  const [receiveKeywords, setReceiveKeywords] = useState('');
  const [excludedKeywords, setExcludedKeywords] = useState('');
  const [threshold, setThreshold] = useState(70);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const result = await getConfig();
      if (result.success && result.config) {
        setPresetNames(result.config.preset_names.join('\n'));
        setLendKeywords(result.config.lend_keywords.join('\n'));
        setReceiveKeywords(result.config.receive_keywords.join('\n'));
        setExcludedKeywords(result.config.excluded_keywords.join('\n'));
        setThreshold(result.config.confidence_threshold);
      }
    } catch {
      setMessage('加载配置失败');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePresetNames = async () => {
    const names = presetNames.split('\n').map(n => n.trim()).filter(n => n);
    try {
      const result = await updatePresetNames(names);
      if (result.success) {
        setMessage(result.message);
        setMessageType('success');
      } else {
        setMessage(result.message || '保存失败');
        setMessageType('error');
      }
    } catch {
      setMessage('保存失败');
      setMessageType('error');
    }
  };

  const handleSaveKeywords = async () => {
    const lend = lendKeywords.split('\n').map(k => k.trim()).filter(k => k);
    const receive = receiveKeywords.split('\n').map(k => k.trim()).filter(k => k);
    const excluded = excludedKeywords.split('\n').map(k => k.trim()).filter(k => k);
    
    try {
      const result = await updateKeywords({ lend_keywords: lend, receive_keywords: receive, excluded_keywords: excluded });
      if (result.success) {
        setMessage(result.message);
        setMessageType('success');
      } else {
        setMessage(result.message || '保存失败');
        setMessageType('error');
      }
    } catch {
      setMessage('保存失败');
      setMessageType('error');
    }
  };

  const handleSaveThreshold = async () => {
    if (threshold < 0 || threshold > 100) {
      setMessage('阈值必须在 0-100 之间');
      setMessageType('error');
      return;
    }

    try {
      const result = await updateThreshold(threshold);
      if (result.success) {
        setMessage(result.message);
        setMessageType('success');
      } else {
        setMessage(result.message || '保存失败');
        setMessageType('error');
      }
    } catch {
      setMessage('保存失败');
      setMessageType('error');
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-40">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">配置管理</h2>
        <button
          onClick={loadConfig}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-3 rounded-lg ${
          messageType === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
        }`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-800">预设人名</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">每行一个人名，用于文本解析时自动识别</p>
          <textarea
            value={presetNames}
            onChange={(e) => setPresetNames(e.target.value)}
            className="w-full h-40 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            placeholder="输入预设人名，每行一个"
          />
          <button
            onClick={handleSavePresetNames}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            保存预设人名
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-800">关键词设置</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">借出关键词</label>
              <textarea
                value={lendKeywords}
                onChange={(e) => setLendKeywords(e.target.value)}
                className="w-full h-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                placeholder="输入借出相关关键词，每行一个"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">收回关键词</label>
              <textarea
                value={receiveKeywords}
                onChange={(e) => setReceiveKeywords(e.target.value)}
                className="w-full h-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                placeholder="输入收回相关关键词，每行一个"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">排除关键词</label>
              <textarea
                value={excludedKeywords}
                onChange={(e) => setExcludedKeywords(e.target.value)}
                className="w-full h-20 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                placeholder="输入需要排除的关键词，每行一个"
              />
            </div>
          </div>

          <button
            onClick={handleSaveKeywords}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            保存关键词
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Gauge className="w-5 h-5 text-orange-600" />
            <h3 className="font-semibold text-gray-800">置信度阈值</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">文本解析时的置信度阈值，低于此值的条目需要人工确认</p>
          
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="100"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <span className="text-lg font-semibold text-gray-800 w-12 text-center">{threshold}%</span>
          </div>

          <button
            onClick={handleSaveThreshold}
            className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            保存阈值
          </button>
        </div>
      </div>
    </div>
  );
}
