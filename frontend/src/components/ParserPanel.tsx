import { useState } from 'react';
import { parseText, parseAndSave } from '../api';
import { ParsedEntry } from '../types';
import { FileText, CheckCircle, AlertCircle, Save, Zap } from 'lucide-react';

export default function ParserPanel() {
  const [inputText, setInputText] = useState('');
  const [highConfidence, setHighConfidence] = useState<ParsedEntry[]>([]);
  const [lowConfidence, setLowConfidence] = useState<ParsedEntry[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [message, setMessage] = useState('');

  const handleParse = async () => {
    if (!inputText.trim()) {
      setMessage('请输入要解析的文本');
      return;
    }

    setIsParsing(true);
    setMessage('');

    try {
      const result = await parseText(inputText);
      if (result.success) {
        setHighConfidence(result.high_confidence || []);
        setLowConfidence(result.low_confidence || []);
      } else {
        setMessage('解析失败');
      }
    } catch {
      setMessage('网络错误，请稍后重试');
    } finally {
      setIsParsing(false);
    }
  };

  const handleParseAndSave = async (includeLowConfidence: boolean) => {
    if (!inputText.trim()) {
      setMessage('请输入要解析的文本');
      return;
    }

    setIsParsing(true);
    setMessage('');

    try {
      const result = await parseAndSave(inputText, undefined, includeLowConfidence);
      if (result.success) {
        setMessage(result.message);
        setInputText('');
        setHighConfidence([]);
        setLowConfidence([]);
      } else {
        setMessage(result.message || '保存失败');
      }
    } catch {
      setMessage('网络错误，请稍后重试');
    } finally {
      setIsParsing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (dateStr.length === 8) {
      return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }
    return dateStr;
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">文本解析</h2>
      
      {message && (
        <div className="mb-4 p-3 bg-blue-50 text-blue-600 rounded-lg">
          {message}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">输入文本</label>
          <div className="relative">
            <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full pl-10 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              placeholder="请输入账目文本，每行一条记录。例如：&#10;南20240101借1000元&#10;张三20240102还500"
              rows={6}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">支持自动识别日期、人名、金额和类型</p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleParse}
            disabled={isParsing}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Zap className="w-5 h-5" />
            {isParsing ? '解析中...' : '解析文本'}
          </button>
          <button
            onClick={() => handleParseAndSave(false)}
            disabled={isParsing}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {isParsing ? '保存中...' : '解析并保存（高置信度）'}
          </button>
          <button
            onClick={() => handleParseAndSave(true)}
            disabled={isParsing}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {isParsing ? '保存中...' : '解析并保存（全部）'}
          </button>
        </div>

        {highConfidence.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h3 className="font-medium text-gray-800">高置信度结果 ({highConfidence.length})</h3>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <table className="w-full">
                <thead className="text-sm font-medium text-green-800">
                  <tr>
                    <th className="text-left py-2">日期</th>
                    <th className="text-left py-2">人物</th>
                    <th className="text-right py-2">金额</th>
                    <th className="text-center py-2">类型</th>
                    <th className="text-right py-2">置信度</th>
                    <th className="text-left py-2">原文</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-green-700">
                  {highConfidence.map((entry, index) => (
                    <tr key={index} className="border-t border-green-200">
                      <td className="py-2">{formatDate(entry.date)}</td>
                      <td className="py-2">{entry.person}</td>
                      <td className="py-2 text-right">¥{entry.amount}</td>
                      <td className="py-2 text-center">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          entry.type === '借出' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                        }`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="py-2 text-right">{(entry.confidence * 100).toFixed(0)}%</td>
                      <td className="py-2 text-gray-500">{entry.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {lowConfidence.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <h3 className="font-medium text-gray-800">低置信度结果 ({lowConfidence.length})</h3>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <table className="w-full">
                <thead className="text-sm font-medium text-yellow-800">
                  <tr>
                    <th className="text-left py-2">日期</th>
                    <th className="text-left py-2">人物</th>
                    <th className="text-right py-2">金额</th>
                    <th className="text-center py-2">类型</th>
                    <th className="text-right py-2">置信度</th>
                    <th className="text-left py-2">原文</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-yellow-700">
                  {lowConfidence.map((entry, index) => (
                    <tr key={index} className="border-t border-yellow-200">
                      <td className="py-2">{formatDate(entry.date)}</td>
                      <td className="py-2">{entry.person}</td>
                      <td className="py-2 text-right">¥{entry.amount}</td>
                      <td className="py-2 text-center">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          entry.type === '借出' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                        }`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="py-2 text-right">{(entry.confidence * 100).toFixed(0)}%</td>
                      <td className="py-2 text-gray-500">{entry.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {highConfidence.length === 0 && lowConfidence.length === 0 && inputText && !isParsing && (
          <div className="text-center py-8 text-gray-500">
            点击"解析文本"按钮开始解析
          </div>
        )}
      </div>
    </div>
  );
}