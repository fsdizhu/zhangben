import { useState, useRef, useEffect } from 'react';
import { exportCSV, exportExcel, exportExcelByPerson, importCSV, clearDatabase, getPersons } from '../api';
import { Download, FileText, FileSpreadsheet, Users, Upload, AlertCircle, AlertTriangle, X, Calendar, CheckSquare, Square } from 'lucide-react';

export default function ExportPanel() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearPassword, setClearPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showPersonFilter, setShowPersonFilter] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allPersons, setAllPersons] = useState<string[]>([]);
  const [selectedPersons, setSelectedPersons] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadPersons = async () => {
      try {
        const result = await getPersons();
        if (result.success && result.persons) {
          setAllPersons(result.persons);
        }
      } catch {
        console.error('加载人员列表失败');
      }
    };
    loadPersons();
  }, []);

  const togglePerson = (person: string) => {
    if (selectedPersons.includes(person)) {
      setSelectedPersons(selectedPersons.filter(p => p !== person));
    } else {
      setSelectedPersons([...selectedPersons, person]);
    }
  };

  const toggleAllPersons = () => {
    if (selectedPersons.length === allPersons.length) {
      setSelectedPersons([]);
    } else {
      setSelectedPersons([...allPersons]);
    }
  };

  const isValidDate = (date: string) => /^\d{8}$/.test(date);

  const handleExport = async (type: 'csv' | 'excel' | 'excel-by-person') => {
    setIsExporting(true);
    setMessage('');

    try {
      let blob: Blob;
      let filename: string;
      let contentType: string;

      // 判断是否使用日期筛选：只有当开始日期和结束日期都有效时才使用
      const useDateFilter = isValidDate(startDate) && isValidDate(endDate);
      // 判断是否使用人员筛选：只要选中了人员就使用
      const usePersonFilter = selectedPersons.length > 0;

      const persons = usePersonFilter ? selectedPersons : undefined;
      const sDate = useDateFilter ? startDate : undefined;
      const eDate = useDateFilter ? endDate : undefined;

      switch (type) {
        case 'csv':
          blob = await exportCSV(sDate, eDate, persons);
          filename = `account_data_${new Date().toISOString().slice(0, 10)}.csv`;
          contentType = 'text/csv';
          break;
        case 'excel':
          blob = await exportExcel(sDate, eDate, persons);
          filename = `account_data_${new Date().toISOString().slice(0, 10)}.xlsx`;
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case 'excel-by-person':
          blob = await exportExcelByPerson(sDate, eDate, persons);
          filename = `account_data_by_person_${new Date().toISOString().slice(0, 10)}.csv`;
          contentType = 'text/csv';
          break;
        default:
          throw new Error('未知导出类型');
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.type = contentType;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setMessage(`导出成功: ${filename}`);
      setMessageType('success');
    } catch {
      setMessage('导出失败，请稍后重试');
      setMessageType('error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      await parseAndImportCSV(text);
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const parseAndImportCSV = async (csvText: string) => {
    setIsImporting(true);
    setMessage('');

    try {
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) {
        setMessage('CSV 文件内容为空或格式不正确');
        setMessageType('error');
        return;
      }

      const data: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts: string[] = [];
        let current = '';
        let inQuotes = false;

        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            parts.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        parts.push(current.trim());

        if (parts[0] === '日期' || parts[0] === 'date' || parts[0].startsWith('===')) continue;

        if (parts.length >= 5 && parts[0] && parts[1] && parts[3] && parts[4]) {
          data.push({
            date: parts[0],
            person: parts[1],
            description: parts[2] || '',
            amount: parseInt(parts[3], 10) || 0,
            type: parts[4],
          });
        }
      }

      if (data.length === 0) {
        setMessage('未找到有效的账目数据');
        setMessageType('error');
        return;
      }

      const result = await importCSV(data);
      if (result.success) {
        setMessage(result.message);
        setMessageType('success');
      } else {
        setMessage(result.message || '导入失败');
        setMessageType('error');
      }
    } catch {
      setMessage('解析 CSV 文件失败');
      setMessageType('error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!clearPassword) {
      setMessage('请输入密码');
      setMessageType('error');
      return;
    }

    try {
      const result = await clearDatabase(clearPassword);
      if (result.success) {
        setShowClearConfirm(false);
        setClearPassword('');
        setMessage('数据库已清空');
        setMessageType('success');
      } else {
        setMessage(result.message || '清空失败');
        setMessageType('error');
      }
    } catch {
      setMessage('清空失败');
      setMessageType('error');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">数据导入导出</h2>
      
      {message && (
        <div className={`mb-6 p-3 rounded-lg flex items-center gap-2 ${
          messageType === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
        }`}>
          {messageType === 'error' && <AlertCircle className="w-5 h-5" />}
          {message}
        </div>
      )}

      <div className="max-w-2xl">
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            数据导入
          </h3>
          
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition cursor-pointer"
               onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            {isImporting ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-600">正在导入...</p>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-1">点击选择 CSV 文件，或将文件拖拽到此处</p>
                <p className="text-sm text-gray-400">支持从账本导出的 CSV 文件</p>
              </>
            )}
          </div>

          <div className="mt-4 p-3 bg-amber-50 rounded-lg">
            <h4 className="font-medium text-amber-800 mb-2">CSV 文件格式要求：</h4>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• 第一行必须是表头：日期,人物,描述,金额,类型</li>
              <li>• 日期格式：YYYYMMDD（如 20240601）</li>
              <li>• 类型：借出 或 收回</li>
              <li>• 示例：20240601,张三,借款,1000,借出</li>
            </ul>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Download className="w-5 h-5 text-green-600" />
              数据导出
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDateFilter(!showDateFilter)}
                className={`px-3 py-1.5 text-sm rounded-lg transition flex items-center gap-1.5 ${
                  showDateFilter ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Calendar className="w-4 h-4" />
                日期筛选
              </button>
              <button
                onClick={() => setShowPersonFilter(!showPersonFilter)}
                className={`px-3 py-1.5 text-sm rounded-lg transition flex items-center gap-1.5 ${
                  showPersonFilter ? 'bg-purple-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Users className="w-4 h-4" />
                人员筛选
              </button>
            </div>
          </div>

          {showDateFilter && (
            <div className="mb-4 bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex gap-4 flex-wrap">
                <input
                  type="text"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="开始日期 (YYYYMMDD)"
                />
                <span className="flex items-center text-gray-500">至</span>
                <input
                  type="text"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="结束日期 (YYYYMMDD)"
                />
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
                >
                  清除
                </button>
              </div>
            </div>
          )}

          {showPersonFilter && (
            <div className="mb-4 bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-800 text-sm">选择人员</h4>
                <button
                  onClick={toggleAllPersons}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {selectedPersons.length === allPersons.length ? '取消全选' : '全选'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {allPersons.map(person => (
                  <button
                    key={person}
                    onClick={() => togglePerson(person)}
                    className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition ${
                      selectedPersons.includes(person)
                        ? 'bg-purple-100 text-purple-800 border border-purple-300'
                        : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {selectedPersons.includes(person) ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    {person}
                  </button>
                ))}
              </div>
              {selectedPersons.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-sm text-gray-500">已选择 {selectedPersons.length} 人</span>
                  <button
                    onClick={() => setSelectedPersons([])}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    清除选择
                  </button>
                </div>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              className="p-4 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition flex flex-col items-center gap-3"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-center">
                <h4 className="font-medium text-gray-800">导出 CSV</h4>
                <p className="text-xs text-gray-500 mt-1">通用格式，易于导入其他系统</p>
              </div>
            </button>

            <button
              onClick={() => handleExport('excel')}
              disabled={isExporting}
              className="p-4 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition flex flex-col items-center gap-3"
            >
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-center">
                <h4 className="font-medium text-gray-800">导出 Excel</h4>
                <p className="text-xs text-gray-500 mt-1">单工作表格式</p>
              </div>
            </button>

            <button
              onClick={() => handleExport('excel-by-person')}
              disabled={isExporting}
              className="p-4 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition flex flex-col items-center gap-3"
            >
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-center">
                <h4 className="font-medium text-gray-800">按人分组</h4>
                <p className="text-xs text-gray-500 mt-1">每人一个分组</p>
              </div>
            </button>
          </div>

          {isExporting && (
            <div className="mt-4 flex items-center justify-center gap-2 text-blue-600">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              正在导出...
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            危险操作
          </h3>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 mb-4">此操作将清空所有账目数据，请谨慎使用</p>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              清空数据库
            </button>
          </div>
        </div>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                确认清空数据库
              </h3>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-red-600 font-medium mb-2">警告：此操作不可恢复！</p>
              <p className="text-gray-700">确认要清空所有账目数据吗？</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">请输入密码确认</label>
              <input
                type="password"
                value={clearPassword}
                onChange={(e) => setClearPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                placeholder="请输入密码"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                取消
              </button>
              <button
                onClick={handleClearDatabase}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
