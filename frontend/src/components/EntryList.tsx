import { useState } from 'react';
import { searchEntries } from '../api';
import { Entry } from '../types';
import { Search, Trash2, Edit2, RefreshCw, Calendar, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, X, AlertTriangle } from 'lucide-react';
import { useEntries, useUpdateEntry, useDeleteEntry } from '../hooks/useEntries';

export default function EntryList() {
  const [filter, setFilter] = useState<'all' | 'lend' | 'receive'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [useSearchMode, setUseSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState<Entry[]>([]);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editForm, setEditForm] = useState({
    date: '',
    person: '',
    amount: '',
    type: '借出' as '借出' | '收回',
    description: '',
    password: '',
  });
  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sortBy, setSortBy] = useState('id');
  const [order, setOrder] = useState('desc');
  const [message, setMessage] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [pageSizeOptions] = useState([10, 20, 50, 100, 200]);

  const { data: entriesResult, isLoading, refetch } = useEntries(sortBy, order, currentPage, pageSize);
  const updateMutation = useUpdateEntry();
  const deleteMutation = useDeleteEntry();

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setUseSearchMode(false);
      setSearchResults([]);
      return;
    }
    
    try {
      const result = await searchEntries(searchTerm);
      if (result.success && result.entries) {
        setSearchResults(result.entries);
        setUseSearchMode(true);
      }
    } catch {
      setMessage('搜索失败');
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setUseSearchMode(false);
    setSearchResults([]);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setOrder('desc');
    }
  };

  const handleDeleteClick = (entry: Entry) => {
    setDeletingEntry(entry);
    setDeletePassword('');
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEntry) return;
    if (!deletePassword) {
      setMessage('请输入密码');
      return;
    }
    
    try {
      await deleteMutation.mutateAsync({ id: deletingEntry.id, password: deletePassword });
      setShowDeleteConfirm(false);
      setDeletingEntry(null);
      setDeletePassword('');
      setMessage('删除成功');
    } catch (error: any) {
      setMessage(error.message || '删除失败');
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setDeletingEntry(null);
    setDeletePassword('');
  };

  const handleEdit = (entry: Entry) => {
    setEditingEntry(entry);
    setEditForm({
      date: entry.date,
      person: entry.person,
      amount: entry.amount.toString(),
      type: entry.type,
      description: entry.description || '',
      password: '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;

    if (!editForm.date || !editForm.person || !editForm.amount || !editForm.password) {
      setMessage('日期、人物、金额和密码不能为空');
      return;
    }

    const amountNum = parseInt(editForm.amount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      setMessage('金额必须是正整数');
      return;
    }

    try {
      await updateMutation.mutateAsync({ 
        id: editingEntry.id, 
        entry: {
          date: editForm.date,
          person: editForm.person,
          amount: amountNum,
          type: editForm.type,
          description: editForm.description,
        }, 
        password: editForm.password 
      });
      setEditingEntry(null);
      setMessage('更新成功');
    } catch (error: any) {
      setMessage(error.message || '更新失败');
    }
  };

  const displayEntries: Entry[] = useSearchMode 
    ? searchResults 
    : (entriesResult?.success ? entriesResult.entries || [] : []);
  
  const total = useSearchMode 
    ? searchResults.length 
    : (entriesResult?.success ? entriesResult.total || 0 : 0);
  
  const totalPages = Math.ceil(total / pageSize);
  
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const formatDate = (dateStr: string) => {
    if (dateStr.length === 8) {
      return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }
    return dateStr;
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ArrowUpDown className="w-4 h-4 inline-block ml-1 opacity-50" />;
    return order === 'asc' ? <ArrowUp className="w-4 h-4 inline-block ml-1" /> : <ArrowDown className="w-4 h-4 inline-block ml-1" />;
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">账目列表</h2>
        
        {message && (
          <div className="mb-4 p-3 bg-blue-50 text-blue-600 rounded-lg">
            {message}
          </div>
        )}

        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="搜索人物、日期或描述"
            />
            {searchTerm && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <button
                  onClick={handleSearch}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
                >
                  搜索
                </button>
                <button
                  onClick={clearSearch}
                  className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition"
                >
                  清除
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {!useSearchMode && (
              <>
                <button
                  onClick={() => { setFilter('all'); setShowDateFilter(false); }}
                  className={`px-4 py-2 rounded-lg transition ${
                    filter === 'all' && !showDateFilter ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  全部
                </button>
                <button
                  onClick={() => { setFilter('lend'); setShowDateFilter(false); }}
                  className={`px-4 py-2 rounded-lg transition ${
                    filter === 'lend' ? 'bg-red-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  借出
                </button>
                <button
                  onClick={() => { setFilter('receive'); setShowDateFilter(false); }}
                  className={`px-4 py-2 rounded-lg transition ${
                    filter === 'receive' ? 'bg-green-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  收回
                </button>
              </>
            )}
            {!useSearchMode && (
              <button
                onClick={() => setShowDateFilter(!showDateFilter)}
                className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                  showDateFilter ? 'bg-purple-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Calendar className="w-4 h-4" />
                日期筛选
              </button>
            )}
            <button
              onClick={() => { refetch(); clearSearch(); }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
          </div>
        </div>

        {showDateFilter && (
          <div className="flex gap-4 mt-4">
            <input
              type="text"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="开始日期 (YYYYMMDD)"
            />
            <span className="flex items-center text-gray-500">至</span>
            <input
              type="text"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="结束日期 (YYYYMMDD)"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">序号</th>
                    <th 
                      className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('date')}
                    >
                      日期 <SortIcon column="date" />
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('person')}
                    >
                      人物 <SortIcon column="person" />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">描述</th>
                    <th 
                      className="px-4 py-3 text-right text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('amount')}
                    >
                      金额 <SortIcon column="amount" />
                    </th>
                    <th 
                      className="px-4 py-3 text-center text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('type')}
                    >
                      类型 <SortIcon column="type" />
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {displayEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        {useSearchMode ? '未找到匹配结果' : '暂无数据'}
                      </td>
                    </tr>
                  ) : (
                    displayEntries.map((entry: Entry, index: number) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">{useSearchMode ? index + 1 : (currentPage - 1) * pageSize + index + 1}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(entry.date)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{entry.person}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{entry.description}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">¥{entry.amount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            entry.type === '借出' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {entry.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleEdit(entry)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="编辑"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(entry)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {!useSearchMode && (
              <div className="mt-4 flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">每页显示：</span>
                  <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(parseInt(e.target.value, 10))}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    {pageSizeOptions.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-600 ml-4">
                    共 {total} 条记录，第 {currentPage} / {totalPages} 页
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    首页
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-2 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1 rounded-lg text-sm transition ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    末页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {editingEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">编辑账目</h3>
              <button
                onClick={() => setEditingEntry(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                <input
                  type="text"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">人物</label>
                <input
                  type="text"
                  value={editForm.person}
                  onChange={(e) => setEditForm({ ...editForm, person: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">金额</label>
                <input
                  type="number"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">类型</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={editForm.type === '借出'}
                      onChange={() => setEditForm({ ...editForm, type: '借出' })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span>借出</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={editForm.type === '收回'}
                      onChange={() => setEditForm({ ...editForm, type: '收回' })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span>收回</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码验证</label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="请输入密码确认修改"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setEditingEntry(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && deletingEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                删除确认
              </h3>
              <button
                onClick={handleDeleteCancel}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 mb-2">确定要删除这条账目吗？</p>
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <p><span className="font-medium">日期：</span>{formatDate(deletingEntry.date)}</p>
                <p><span className="font-medium">人物：</span>{deletingEntry.person}</p>
                <p><span className="font-medium">金额：</span>¥{deletingEntry.amount.toLocaleString()}</p>
                <p><span className="font-medium">类型：</span>{deletingEntry.type}</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">请输入密码确认删除</label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                placeholder="请输入密码"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleDeleteCancel}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
