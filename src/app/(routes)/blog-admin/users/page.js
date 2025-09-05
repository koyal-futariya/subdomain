'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaTrash, FaEdit, FaUserShield, FaUserPlus, FaSpinner, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { fetchWithAuth } from '../../../utils/auth';
import { useAuth } from '../../../context/AuthContext';
import { useBlogPermission } from '../../../utils/blogAuth';

const UserManagement = () => {
  const router = useRouter();
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user',
  });

  // Edit modal state (password fields removed)
  const [showEdit, setShowEdit] = useState(false);
  const [editUser, setEditUser] = useState({
    id: '',
    username: '',
    role: 'user',
  });

  // Permission checks
  const canCreateUsers = useBlogPermission('users:create');
  const canDeleteUsers = useBlogPermission('users:delete');
  const canEditUsers = useBlogPermission('users:edit');

  // API Configuration
  const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/auth/users', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch users`);
      }

      const result = await response.json();
      const usersList = Array.isArray(result) ? result : result.users || result.data || [];
      setUsers(usersList);
    } catch (error) {
      toast.error(`Failed to load users: ${error.message}`, {
        autoClose: 5000,
        closeOnClick: true,
        pauseOnHover: true,
      });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewUser((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddUser = async (e) => {
    e.preventDefault();

    if (!canCreateUsers) {
      toast.error('You do not have permission to create users', { autoClose: 3000 });
      return;
    }

    if (newUser.password !== newUser.confirmPassword) {
      toast.error('Passwords do not match', { autoClose: 3000 });
      return;
    }

    if (newUser.password.length < 6) {
      toast.error('Password must be at least 6 characters long', { autoClose: 3000 });
      return;
    }

    setActionLoading(true);
    try {
      const userData = {
        username: newUser.username.trim(),
        password: newUser.password,
        email: newUser.email?.trim() || undefined,
        role: newUser.role,
      };

      const response = await fetchWithAuth('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to create user`);
      }

      const result = await response.json();

      toast.success(result.message || 'User created successfully', { autoClose: 3000 });
      setNewUser({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'user',
      });
      setShowAddUser(false);
      await fetchUsers();
    } catch (error) {
      let errorMessage = 'Failed to create user. Please try again.';
      if (error.message?.includes('already exists') || error.message?.includes('already taken')) {
        if (error.message.toLowerCase().includes('email')) {
          errorMessage = 'This email is already in use. Please use a different email.';
        } else if (error.message.toLowerCase().includes('username')) {
          errorMessage = 'This username is already taken. Please choose a different one.';
        } else {
          errorMessage = error.message;
        }
      } else if (error.message?.includes('validation')) {
        errorMessage = error.message;
      } else if (error.message?.includes('NetworkError') || error.message?.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your internet connection and ensure the backend server is running.';
      } else {
        errorMessage = error.message || errorMessage;
      }

      toast.error(errorMessage, {
        autoClose: 5000,
        closeOnClick: true,
        pauseOnHover: true,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!canDeleteUsers) {
      toast.error('You do not have permission to delete users', { autoClose: 3000 });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetchWithAuth(`/api/auth/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to delete user`);
      }

      const result = await response.json();
      toast.success(result.message || 'User deleted successfully', { autoClose: 3000 });
      await fetchUsers();
    } catch (error) {
      let errorMessage = 'Failed to delete user';
      if (error.message?.includes('cannot delete') || error.message?.includes('main admin')) {
        errorMessage = 'Cannot delete the main admin user.';
      } else if (error.message?.includes('not found')) {
        errorMessage = 'User not found.';
      } else if (error.message?.includes('permission')) {
        errorMessage = 'You do not have permission to delete this user.';
      } else {
        errorMessage = error.message || errorMessage;
      }

      toast.error(errorMessage, {
        autoClose: 5000,
        closeOnClick: true,
        pauseOnHover: true,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Edit helpers (password fields removed)
  const openEdit = (u) => {
    setEditUser({
      id: u._id || u.id,
      username: u.username || '',
      role: u.role || 'user',
    });
    setShowEdit(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!canEditUsers) {
      toast.error('You do not have permission to edit users', { autoClose: 3000 });
      return;
    }
    setActionLoading(true);
    try {
      const payload = {
        username: editUser.username?.trim() || undefined,
        role: editUser.role || undefined,
      };
      const res = await fetchWithAuth(`/api/auth/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || `HTTP ${res.status}: Failed to update user`);
      }
      const data = await res.json();
      toast.success(data.message || 'User updated successfully', { autoClose: 3000 });
      setShowEdit(false);
      await fetchUsers();
    } catch (err) {
      toast.error(err.message || 'Failed to update user', { autoClose: 5000 });
    } finally {
      setActionLoading(false);
    }
  };

  const roleBadgeClass = (role) => {
    if (role === 'superadmin') return 'bg-purple-100 text-purple-800';
    if (role === 'admin') return 'bg-green-100 text-green-800';
    return 'bg-blue-100 text-blue-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] px-4">
        <div className="text-center">
          <FaSpinner className="animate-spin h-8 w-8 sm:h-10 sm:w-10 text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600 text-sm sm:text-base">Loading users from Express backend...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col space-y-4 sm:flex-row sm:justify-between sm:items-start sm:space-y-0">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">User Management</h1>
              <p className="text-sm sm:text-base text-gray-600">Manage blog admin users and their roles via Express backend</p>
            </div>

            {canCreateUsers && (
              <div className="w-full sm:w-auto">
                <button
                  onClick={() => setShowAddUser(true)}
                  disabled={actionLoading}
                  className="flex items-center justify-center w-full sm:w-auto px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
                >
                  {actionLoading ? (
                    <FaSpinner className="animate-spin mr-2 h-4 w-4" />
                  ) : (
                    <FaUserPlus className="mr-2 h-4 w-4" />
                  )}
                  <span>Add New User</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Add User Modal */}
        {showAddUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 lg:p-6">
            <div className="bg-white rounded-xl w-full max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl max-h-[95vh] overflow-y-auto shadow-2xl border-0 sm:border">
              <div className="p-4 sm:p-6 lg:p-8">
                <div className="flex justify-between items-center mb-6 lg:mb-8">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">Add New User</h2>
                  <button
                    onClick={() => setShowAddUser(false)}
                    disabled={actionLoading}
                    className="text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <FaTimes className="w-5 h-5 lg:w-6 lg:h-6" />
                  </button>
                </div>

                <form onSubmit={handleAddUser} className="space-y-4 lg:space-y-6">
                  <div>
                    <label className="block text-sm lg:text-base font-semibold text-gray-700 mb-2 lg:mb-3">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="username"
                      value={newUser.username}
                      onChange={handleInputChange}
                      disabled={actionLoading}
                      className="w-full px-4 lg:px-5 py-3 lg:py-4 border border-gray-300 rounded-lg lg:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-sm lg:text-base transition-all duration-200"
                      required
                      placeholder="johndoe"
                      minLength={3}
                      maxLength={30}
                    />
                  </div>

                  <div>
                    <label className="block text-sm lg:text-base font-semibold text-gray-700 mb-2 lg:mb-3">Email (optional)</label>
                    <input
                      type="email"
                      name="email"
                      value={newUser.email}
                      onChange={handleInputChange}
                      disabled={actionLoading}
                      className="w-full px-4 lg:px-5 py-3 lg:py-4 border border-gray-300 rounded-lg lg:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-sm lg:text-base transition-all duration-200"
                      placeholder="user@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm lg:text-base font-semibold text-gray-700 mb-2 lg:mb-3">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="role"
                      value={newUser.role}
                      onChange={handleInputChange}
                      disabled={actionLoading}
                      className="w-full px-4 lg:px-5 py-3 lg:py-4 border border-gray-300 rounded-lg lg:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-sm lg:text-base transition-all duration-200"
                      required
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      {user?.role?.toLowerCase() === 'superadmin' && <option value="superadmin">SuperAdmin</option>}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                    <div>
                      <label className="block text-sm lg:text-base font-semibold text-gray-700 mb-2 lg:mb-3">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        name="password"
                        value={newUser.password}
                        onChange={handleInputChange}
                        disabled={actionLoading}
                        className="w-full px-4 lg:px-5 py-3 lg:py-4 border border-gray-300 rounded-lg lg:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-sm lg:text-base transition-all duration-200"
                        required
                        minLength={6}
                        placeholder="Minimum 6 characters"
                      />
                    </div>

                    <div>
                      <label className="block text-sm lg:text-base font-semibold text-gray-700 mb-2 lg:mb-3">
                        Confirm Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        name="confirmPassword"
                        value={newUser.confirmPassword}
                        onChange={handleInputChange}
                        disabled={actionLoading}
                        className="w-full px-4 lg:px-5 py-3 lg:py-4 border border-gray-300 rounded-lg lg:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-sm lg:text-base transition-all duration-200"
                        required
                        minLength={6}
                        placeholder="Confirm password"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 pt-4 lg:pt-6">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="flex-1 px-6 lg:px-8 py-3 lg:py-4 bg-blue-600 text-white rounded-lg lg:rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center text-sm lg:text-base font-medium transition-all duration-200 shadow-lg"
                    >
                      {actionLoading ? (
                        <>
                          <FaSpinner className="animate-spin mr-2 h-4 w-4 lg:h-5 lg:w-5" />
                          Creating...
                        </>
                      ) : (
                        'Create User'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddUser(false)}
                      disabled={actionLoading}
                      className="flex-1 px-6 lg:px-8 py-3 lg:py-4 border border-gray-300 rounded-lg lg:rounded-xl text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-50 text-sm lg:text-base font-medium transition-all duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal (Change Password removed) */}
        {showEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 lg:p-6">
            <div className="bg-white rounded-xl w-full max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-2xl max-h-[95vh] overflow-y-auto shadow-2xl border-0 sm:border">
              <div className="p-4 sm:p-6 lg:p-8">
                <div className="flex justify-between items-center mb-6 lg:mb-8">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">Edit User</h2>
                  <button
                    onClick={() => setShowEdit(false)}
                    disabled={actionLoading}
                    className="text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <FaTimes className="w-5 h-5 lg:w-6 lg:h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="lg:pr-4">
                    <h3 className="text-lg lg:text-xl font-semibold text-gray-800 mb-4 lg:mb-6 border-b border-gray-200 pb-2">
                      User Information
                    </h3>

                    <form onSubmit={handleUpdateUser} className="space-y-4 lg:space-y-6">
                      <div>
                        <label className="block text-sm lg:text-base font-semibold text-gray-700 mb-2 lg:mb-3">Username</label>
                        <input
                          type="text"
                          name="username"
                          value={editUser.username}
                          onChange={handleEditChange}
                          disabled={actionLoading}
                          className="w-full px-4 lg:px-5 py-3 lg:py-4 border border-gray-300 rounded-lg lg:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-sm lg:text-base transition-all duration-200"
                          minLength={3}
                          maxLength={30}
                          placeholder="Enter username"
                        />
                      </div>

                      <div>
                        <label className="block text-sm lg:text-base font-semibold text-gray-700 mb-2 lg:mb-3">Role</label>
                        <select
                          name="role"
                          value={editUser.role}
                          onChange={handleEditChange}
                          disabled={actionLoading}
                          className="w-full px-4 lg:px-5 py-3 lg:py-4 border border-gray-300 rounded-lg lg:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-sm lg:text-base transition-all duration-200"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                          {user?.role?.toLowerCase() === 'superadmin' && <option value="superadmin">SuperAdmin</option>}
                        </select>
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={actionLoading}
                          className="w-full px-6 lg:px-8 py-3 lg:py-4 bg-blue-600 text-white rounded-lg lg:rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center text-sm lg:text-base font-medium transition-all duration-200 shadow-lg"
                        >
                          {actionLoading ? <FaSpinner className="animate-spin mr-2 h-4 w-4 lg:h-5 lg:w-5" /> : null}
                          Save Changes
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Mobile/Tablet Close Button */}
                  <div className="lg:hidden mt-6 pt-6 border-t border-gray-200">
                    <button
                      onClick={() => setShowEdit(false)}
                      disabled={actionLoading}
                      className="w-full px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-50 text-sm font-medium transition-all duration-200"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users List */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <div className="flex flex-col space-y-2 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">Blog Admin Users</h2>
              <div className="flex items-center justify-between sm:space-x-4">
                <span className="text-sm text-gray-500 font-medium">{Array.isArray(users) ? `${users.length} user(s) found` : ''}</span>
                <button
                  onClick={fetchUsers}
                  disabled={loading}
                  className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  {loading ? <FaSpinner className="animate-spin mr-2 h-4 w-4" /> : null}
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {!users || !Array.isArray(users) || users.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FaUserShield className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-800 mb-2">No users found</h3>
              <p className="text-sm text-gray-600 mb-6">Get started by adding your first user to the system.</p>
              {canCreateUsers && (
                <button
                  onClick={() => setShowAddUser(true)}
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 inline-flex items-center justify-center text-sm font-medium transition-colors shadow-sm"
                >
                  <FaUserPlus className="mr-2 h-4 w-4" />
                  Add First User
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((userItem) => (
                        <tr key={userItem._id || userItem.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-blue-100 rounded-full">
                                <FaUserShield className="h-5 w-5 text-blue-600" />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{userItem.username}</div>
                                <div className="text-sm text-gray-500">{userItem.email || 'No email'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleBadgeClass(userItem.role)}`}>
                              {userItem.role || 'user'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                userItem.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {userItem.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {userItem.createdAt ? new Date(userItem.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                            <div className="flex justify-center space-x-3">
                              {canEditUsers && (
                                <button
                                  onClick={() => openEdit(userItem)}
                                  disabled={actionLoading || (userItem.role === 'superadmin' && user?.role?.toLowerCase() !== 'superadmin')}
                                  className="text-blue-600 hover:text-blue-900 disabled:text-gray-400 disabled:cursor-not-allowed p-2 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit user"
                                >
                                  <FaEdit className="h-4 w-4" />
                                </button>
                              )}
                              {canDeleteUsers && (
                                <button
                                  onClick={() => handleDeleteUser(userItem._id || userItem.id, userItem.username)}
                                  disabled={
                                    actionLoading ||
                                    userItem.username === 'admin' ||
                                    userItem._id === user?.id ||
                                    userItem.id === user?.id ||
                                    (userItem.role === 'superadmin' && user?.role?.toLowerCase() !== 'superadmin')
                                  }
                                  className="text-red-600 hover:text-red-900 disabled:text-gray-400 disabled:cursor-not-allowed p-2 hover:bg-red-50 rounded transition-colors"
                                  title={
                                    userItem.username === 'admin'
                                      ? 'Cannot delete main admin'
                                      : userItem._id === user?.id || userItem.id === user?.id
                                      ? 'Cannot delete yourself'
                                      : userItem.role === 'superadmin' && user?.role?.toLowerCase() !== 'superadmin'
                                      ? 'Cannot delete superadmin'
                                      : 'Delete user'
                                  }
                                >
                                  {actionLoading ? <FaSpinner className="animate-spin h-4 w-4" /> : <FaTrash className="h-4 w-4" />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile & Tablet Cards */}
              <div className="lg:hidden">
                <div className="divide-y divide-gray-200">
                  {users.map((userItem) => (
                    <div key={userItem._id || userItem.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start flex-1 min-w-0">
                          <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center bg-blue-100 rounded-full">
                            <FaUserShield className="h-6 w-6 text-blue-600" />
                          </div>
                          <div className="ml-4 flex-1 min-w-0">
                            <div className="text-base font-semibold text-gray-900 truncate">{userItem.username}</div>
                            <div className="text-sm text-gray-500 truncate mb-3">{userItem.email || 'No email'}</div>

                            <div className="flex flex-wrap gap-2 mb-3">
                              <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${roleBadgeClass(userItem.role)}`}>
                                {userItem.role || 'user'}
                              </span>
                              <span
                                className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  userItem.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {userItem.isActive !== false ? 'Active' : 'Inactive'}
                              </span>
                            </div>

                            <div className="text-xs text-gray-500">
                              Created: {userItem.createdAt ? new Date(userItem.createdAt).toLocaleDateString() : 'N/A'}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col space-y-2 ml-4">
                          {canEditUsers && (
                            <button
                              onClick={() => openEdit(userItem)}
                              disabled={actionLoading || (userItem.role === 'superadmin' && user?.role?.toLowerCase() !== 'superadmin')}
                              className="flex items-center justify-center p-3 text-blue-600 hover:text-blue-800 hover:bg-blue-50 disabled:text-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                              title="Edit user"
                            >
                              <FaEdit className="h-5 w-5" />
                            </button>
                          )}
                          {canDeleteUsers && (
                            <button
                              onClick={() => handleDeleteUser(userItem._id || userItem.id, userItem.username)}
                              disabled={
                                actionLoading ||
                                userItem.username === 'admin' ||
                                userItem._id === user?.id ||
                                userItem.id === user?.id ||
                                (userItem.role === 'superadmin' && user?.role?.toLowerCase() !== 'superadmin')
                              }
                              className="flex items-center justify-center p-3 text-red-600 hover:text-red-800 hover:bg-red-50 disabled:text-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                              title={
                                userItem.username === 'admin'
                                  ? 'Cannot delete main admin'
                                  : userItem._id === user?.id || userItem.id === user?.id
                                  ? 'Cannot delete yourself'
                                  : userItem.role === 'superadmin' && user?.role?.toLowerCase() !== 'superadmin'
                                  ? 'Cannot delete superadmin'
                                  : 'Delete user'
                              }
                            >
                              {actionLoading ? <FaSpinner className="animate-spin h-5 w-5" /> : <FaTrash className="h-5 w-5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
