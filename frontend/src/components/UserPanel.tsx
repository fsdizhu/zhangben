import { useState, useEffect } from 'react';
import { getUsers, addUser, deleteUser, updateUser, getPermissions } from '../api';
import { User, PermissionInfo, AddUserRequest, UpdateUserRequest, PERMISSION_LABELS } from '../types';
import { Users, Trash2, Edit2, Save, X, Check, AlertCircle, Shield, UserPlus } from 'lucide-react';

export default function UserPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<PermissionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [message, setMessage] = useState('');
  const [addForm, setAddForm] = useState({
    username: '',
    password: '',
    is_super: false,
    permissions: [] as string[],
  });
  const [editForm, setEditForm] = useState({
    password: '',
    is_super: false,
    permissions: [] as string[],
  });

  useEffect(() => {
    Promise.all([loadUsers(), loadPermissions()]).then(() => setLoading(false));
  }, []);

  const loadUsers = async () => {
    try {
      const result = await getUsers();
      if (result.success && result.users) {
        setUsers(result.users);
      }
    } catch {
      setMessage('加载用户列表失败');
    }
  };

  const loadPermissions = async () => {
    try {
      const result = await getPermissions();
      if (result.success && result.permissions) {
        setPermissions(result.permissions);
      }
    } catch {
      console.error('加载权限列表失败');
    }
  };

  const handleAddUser = async () => {
    if (!addForm.username || !addForm.password) {
      setMessage('用户名和密码不能为空');
      return;
    }

    try {
      const data: AddUserRequest = {
        username: addForm.username,
        password: addForm.password,
        is_super: addForm.is_super,
        permissions: addForm.is_super ? [] : addForm.permissions,
      };

      const result = await addUser(data);
      
      if (result.success) {
        setMessage(result.message);
        setShowAddModal(false);
        setAddForm({ username: '', password: '', is_super: false, permissions: [] });
        loadUsers();
      } else {
        setMessage(result.message || '添加失败');
      }
    } catch {
      setMessage('添加失败');
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (username === 'root') {
      setMessage('不能删除超级管理员账户');
      return;
    }

    if (!confirm(`确定要删除用户 "${username}" 吗？`)) {
      return;
    }

    try {
      const result = await deleteUser(username);
      if (result.success) {
        setMessage(result.message);
        loadUsers();
      } else {
        setMessage(result.message || '删除失败');
      }
    } catch {
      setMessage('删除失败');
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditForm({ 
      password: '', 
      is_super: user.is_super, 
      permissions: user.permissions || [] 
    });
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    try {
      const data: UpdateUserRequest = {
        password: editForm.password || undefined,
        is_super: editForm.is_super,
        permissions: editForm.is_super ? [] : editForm.permissions,
      };

      const result = await updateUser(editingUser.username, data);

      if (result.success) {
        setMessage(result.message);
        setEditingUser(null);
        loadUsers();
      } else {
        setMessage(result.message || '更新失败');
      }
    } catch {
      setMessage('更新失败');
    }
  };

  const toggleEditPermission = (permission: string) => {
    setEditForm({
      ...editForm,
      permissions: editForm.permissions.includes(permission)
        ? editForm.permissions.filter(p => p !== permission)
        : [...editForm.permissions, permission],
    });
  };

  const toggleAddPermission = (permission: string) => {
    setAddForm({
      ...addForm,
      permissions: addForm.permissions.includes(permission)
        ? addForm.permissions.filter(p => p !== permission)
        : [...addForm.permissions, permission],
    });
  };

  const renderPermissionTags = (permList: string[]) => {
    if (permList.length === 0) {
      return <span className="text-gray-400 text-sm">无权限</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {permList.map(p => (
          <span 
            key={p} 
            className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full"
          >
            {PERMISSION_LABELS[p] || p}
          </span>
        ))}
      </div>
    );
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
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-800">用户管理</h2>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          添加用户
        </button>
      </div>

      {message && (
        <div className="mb-6 p-3 bg-blue-50 text-blue-600 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {message}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">用户名</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">角色</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">权限</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  暂无用户
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.username} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {user.username}
                    {user.username === 'root' && (
                      <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        超级管理员
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {user.is_super ? (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                        超级用户
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                        普通用户
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.is_super ? (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                        全部权限
                      </span>
                    ) : (
                      renderPermissionTags(user.permissions || [])
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingUser?.username === user.username ? (
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                          title="保存"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingUser(null)}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition"
                          title="取消"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-center gap-2">
                        {user.username !== 'root' && (
                          <button
                            onClick={() => handleEditUser(user)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {user.username !== 'root' && (
                          <button
                            onClick={() => handleDeleteUser(user.username)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {editingUser && (
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <h3 className="font-medium text-gray-800 mb-4">编辑用户: {editingUser.username}</h3>
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">新密码（留空不修改）</label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="输入新密码"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.is_super}
                  onChange={(e) => setEditForm({ ...editForm, is_super: e.target.checked, permissions: e.target.checked ? [] : editForm.permissions })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-700">设为超级用户（拥有全部权限）</span>
              </label>
              {!editForm.is_super && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    权限设置
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {permissions.map(perm => (
                      <label 
                        key={perm.key}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition ${
                          editForm.permissions.includes(perm.key) 
                            ? 'bg-blue-50 border border-blue-200' 
                            : 'bg-white border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={editForm.permissions.includes(perm.key)}
                          onChange={() => toggleEditPermission(perm.key)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  保存修改
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">添加用户</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                <input
                  type="text"
                  value={addForm.username}
                  onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="输入用户名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                <input
                  type="password"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="输入密码"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addForm.is_super}
                  onChange={(e) => setAddForm({ ...addForm, is_super: e.target.checked, permissions: e.target.checked ? [] : addForm.permissions })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-700">设为超级用户（拥有全部权限）</span>
              </label>
              {!addForm.is_super && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    权限设置
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {permissions.map(perm => (
                      <label 
                        key={perm.key}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition ${
                          addForm.permissions.includes(perm.key) 
                            ? 'bg-blue-50 border border-blue-200' 
                            : 'bg-white border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={addForm.permissions.includes(perm.key)}
                          onChange={() => toggleAddPermission(perm.key)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                取消
              </button>
              <button
                onClick={handleAddUser}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
