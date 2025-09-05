"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { 
  FaSpinner, 
  FaSignOutAlt, 
  FaBlog, 
  FaUsers, 
  FaHome, 
  FaUser, 
  FaExclamationTriangle, 
  FaChevronRight, 
  FaUserCog,
  FaChevronDown
} from "react-icons/fa";

import { useAuth } from "../../context/AuthContext";

// Safe context hook with error handling
const useSafeAuth = () => {
  try {
    const context = useAuth();
    
    if (!context) {
      return {
        user: null,
        loading: false,
        isAuthenticated: () => false,
        hasRole: () => false,
        login: () => Promise.reject(new Error('Auth not available')),
        logout: () => Promise.reject(new Error('Auth not available'))
      };
    }
    
    return context;
  } catch (error) {
    console.error('useSafeAuth error:', error);
    return {
      user: null,
      loading: false,
      isAuthenticated: () => false,
      hasRole: () => false,
      login: () => Promise.reject(new Error('Auth not available')),
      logout: () => Promise.reject(new Error('Auth not available'))
    };
  }
};

const BlogAdminLayout = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  
  // Use safe auth hook
  const { user, loading, logout, isAuthenticated, hasRole } = useSafeAuth();
  
  const [localLoading, setLocalLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);

  const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

  // Memoize the role checker function
  const userHasRole = useCallback((userRole, allowedRoles) => {
    if (!userRole || !Array.isArray(allowedRoles)) return false;
    
    const userRoleLower = userRole.toLowerCase();
    return allowedRoles.some(role => role.toLowerCase() === userRoleLower);
  }, []);

  // Memoize the checkBlogAccess function
  const checkBlogAccess = useCallback(async () => {
    try {
      setLocalLoading(true);
      setError(null);

      if (loading) return;

      if (!isAuthenticated() || !user) {
        console.log('BlogAdminLayout: User not authenticated, redirecting to login');
        router.push('/AdminLogin');
        return;
      }

      // Allow users, admins, and superadmins
      const hasRequiredRole = userHasRole(user.role, ['admin', 'superadmin', 'user']);
      
      console.log('BlogAdminLayout: Access check', {
        user: user.username,
        role: user.role,
        hasRequiredRole,
        isActive: user.isActive
      });

      if (!hasRequiredRole) {
        setError({
          type: 'permission',
          message: 'Access Denied: You need admin, superadmin, or user privileges to access the blog administration panel.',
          userRole: user.role
        });
        return;
      }

      if (user.isActive === false) {
        setError({
          type: 'inactive',
          message: 'Account Inactive: Your account has been deactivated. Please contact an administrator.'
        });
        return;
      }

      // Test connection (optional, with error handling)
      try {
        const { testConnection } = require("@/app/utils/blogAuth");
        const connectionTest = await testConnection();
        setConnectionStatus(connectionTest);
      } catch (connErr) {
        console.warn('Connection test failed:', connErr);
        setConnectionStatus({ connected: false, message: 'Connection test unavailable' });
      }

    } catch (err) {
      console.error('BlogAdminLayout: Access check error', err);
      setError({
        type: 'error',
        message: 'An error occurred while checking access permissions.'
      });
    } finally {
      setLocalLoading(false);
    }
  }, [user, loading, isAuthenticated, userHasRole, router]);

  // Run the access check when dependencies change
  useEffect(() => {
    checkBlogAccess();
  }, [checkBlogAccess]);

  // Memoize the logout handler
  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.clear();
      router.push('/AdminLogin');
      window.location.reload();
    }
  }, [logout, router]);

  // Handle click outside mobile user menu
  const handleClickOutside = useCallback((event) => {
    if (mobileUserMenuOpen && 
        !event.target.closest('.mobile-user-menu') && 
        !event.target.closest('.mobile-user-menu-trigger')) {
      setMobileUserMenuOpen(false);
    }
  }, [mobileUserMenuOpen, setMobileUserMenuOpen]);

  // Close mobile user menu when clicking outside
  useEffect(() => {
    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);
    
    // Cleanup function
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleClickOutside]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileUserMenuOpen(false);
  }, [pathname]);
  
  // Memoize the toggle sidebar function
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);
  
  // Memoize the toggle mobile menu function
  const toggleMobileUserMenu = useCallback(() => {
    setMobileUserMenuOpen(prev => !prev);
  }, []);

  // Show loading state
  if (loading || localLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <FaSpinner className="animate-spin h-8 w-8 sm:h-10 sm:w-10 text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600 text-sm sm:text-base">Loading blog admin panel...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 border-l-4 border-red-500">
            <div className="flex items-center mb-4">
              <FaExclamationTriangle className="text-red-500 text-xl sm:text-2xl mr-3 flex-shrink-0" />
              <h2 className="text-lg font-semibold text-gray-900">Access Denied</h2>
            </div>
            <p className="text-gray-600 mb-4 text-sm sm:text-base">{error.message}</p>
            {error.userRole && (
              <p className="text-sm text-gray-500 mb-4">
                Current Role: <span className="font-medium capitalize">{error.userRole}</span>
              </p>
            )}
            <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:space-x-3">
              <button
                onClick={() => router.push('/')}
                className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-md transition-colors text-sm sm:text-base font-medium"
              >
                Go to Dashboard
              </button>
              <button
                onClick={handleLogout}
                className="w-full sm:flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-md transition-colors text-sm sm:text-base font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <FaSpinner className="animate-spin h-6 w-6 sm:h-8 sm:w-8 text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600 text-sm sm:text-base">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Navigation items
  const navItems = [
    { 
      name: 'Dashboard', 
      href: '/blog-admin', 
      icon: <FaHome className="w-4 h-4 sm:w-5 sm:h-5" />,
      roles: ['admin', 'superadmin', 'user']
    },
    { 
      name: 'User Management', 
      href: '/blog-admin/users', 
      icon: <FaUsers className="w-4 h-4 sm:w-5 sm:h-5" />,
      roles: ['admin', 'superadmin']
    }
  ];

  const visibleNavItems = navItems.filter(item => {
    return userHasRole(user?.role, item.roles);
  });

  const breadcrumbs = pathname.split('/').filter(segment => segment).map((segment, index, array) => {
    const path = '/' + array.slice(0, index + 1).join('/');
    const name = segment.charAt(0).toUpperCase() + segment.slice(1).replace('-', ' ');
    return { name, path };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Layout: Sidebar + Main Content */}
      <div className="hidden xl:flex h-screen overflow-hidden">
        {/* Desktop Sidebar - Only visible on xl screens and above */}
        <div className={`bg-gray-800 text-white ${sidebarCollapsed ? 'w-16' : 'w-64'} flex-shrink-0 flex-col transition-all duration-300 h-full`}>
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center min-w-0 pt-5">
                <FaBlog className="text-2xl text-blue-400 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <div className="ml-3 min-w-0 ">
                    <h1 className="text-xl font-bold truncate">Blog Admin</h1>
                    <p className="text-xs text-gray-400 truncate">Content Management</p>
                  </div>
                )}
              </div>
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg flex-shrink-0"
              >
                <FaChevronRight className={`transform transition-transform w-4 h-4 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
              </button>
            </div>
            
            {!sidebarCollapsed && user && (
              <div className="flex items-center mt-3 p-3 bg-gray-700 rounded-lg">
                <FaUser className="mr-3 text-gray-300 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{user.username}</p>
                  <p className="text-xs text-gray-400 capitalize truncate">{user.role} Access</p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-2 min-h-0">
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 hover:text-white rounded-md mb-1 transition-colors duration-200 group ${
                    isActive ? 'bg-gray-700 text-white' : ''
                  }`}
                  title={sidebarCollapsed ? item.name : ''}
                >
                  <span className={`text-gray-400 group-hover:text-white transition-colors flex-shrink-0 ${isActive ? 'text-white' : ''}`}>
                    {item.icon}
                  </span>
                  {!sidebarCollapsed && (
                    <span className="ml-3 truncate">{item.name}</span>
                  )}
                </a>
              );
            })}
            
            {!sidebarCollapsed && user && user.role?.toLowerCase() === 'user' && (
              <div className="px-4 py-3 mt-4 text-gray-400 text-xs">
                <p className="mb-2 font-medium">📝 Available Features:</p>
                <ul className="list-disc list-inside text-xs space-y-1">
                  <li>Dashboard overview</li>
                  <li>View your content</li>
                </ul>
                <p className="mt-3 text-gray-500 text-xs">User Management is admin-only</p>
              </div>
            )}
          </nav>

         
          
        </div>

        {/* Desktop Main Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Desktop Header */}
          <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
            <div className="px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="min-w-0 flex-1">
                  {/* Breadcrumbs */}
                  <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
                    <FaHome className="w-4 h-4 flex-shrink-0" />
                    {breadcrumbs.map((crumb, index) => (
                      <div key={crumb.path} className="flex items-center min-w-0">
                        {index > 0 && <FaChevronRight className="w-3 h-3 mx-2 flex-shrink-0" />}
                        <a
                          href={crumb.path}
                          className="hover:text-blue-600 transition-colors truncate"
                        >
                          {crumb.name}
                        </a>
                      </div>
                    ))}
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 truncate">
                    Blog Admin Panel
                  </h2>
                  <p className="text-sm text-gray-500 truncate">
                    {user?.role?.toLowerCase() === 'user' 
                      ? 'Access your content dashboard'
                      : 'Manage blog content and users'
                    }
                  </p>
                </div>
                
                <div className="flex items-center space-x-4 flex-shrink-0">
                  {/* Backend Status */}
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      connectionStatus?.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                    }`}></div>
                    <span className="text-sm text-gray-500">
                      {connectionStatus?.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  {/* User Info */}
                  <div className="flex items-center space-x-2 bg-gray-100 rounded-lg px-3 py-2">
                    <FaUser className="text-gray-500 w-4 h-4" />
                    <div>
                      <p className="text-sm font-medium text-gray-700 truncate">{user.username}</p>
                      <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center space-x-2">
                    <a
                      href="/blogs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <FaBlog className="mr-2 w-4 h-4" />
                      View Blog
                    </a>

                    

                    <button
                      onClick={handleLogout}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 transition-colors"
                    >
                      <FaSignOutAlt className="mr-2 w-4 h-4" />
                      Logout
                    </button>
                  </div>

                  
                </div>
              </div>
            </div>
          </header>

          {/* Desktop Main Content */}
          <main className="flex-1 overflow-y-auto bg-gray-50 min-h-0">
            <div className="p-6">
              <div className="max-w-7xl mx-auto">
                {/* Connection Warning */}
                {connectionStatus && !connectionStatus.connected && (
                  <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
                    <div className="flex">
                      <FaExclamationTriangle className="h-5 w-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium text-yellow-800">Backend Connection Issue</h3>
                        <p className="text-sm text-yellow-700 mt-1">
                          {connectionStatus.message}. Some features may not work properly.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Main Content */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  {children}
                </div>
              </div>
            </div>
          </main>

          {/* Desktop Footer */}
          <footer className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
            <div className="max-w-7xl mx-auto">
              <div className="flex justify-between items-center text-sm text-gray-500">
                <div>
                  <p>© 2025 Blog Admin Panel. </p>
                </div>
                <div className="flex items-center space-x-4">
                  <span>
                    Last Login: {user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'N/A'}
                  </span>
                  <span className={`flex items-center ${connectionStatus?.connected ? 'text-green-500' : 'text-red-500'}`}>
                    <span className="w-2 h-2 rounded-full bg-current mr-1"></span>
                    {connectionStatus?.connected ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Mobile & Tablet Layout: Full-width without sidebar or hamburger menu */}
      <div className="xl:hidden min-h-screen flex flex-col">
        {/* Mobile & Tablet Header with Navigation Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
          <div className="px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex justify-between items-center">
              <div className="min-w-0 flex-1">
                {/* Breadcrumbs - Hidden on small mobile */}
                <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-500 mb-1">
                  <FaHome className="w-4 h-4 flex-shrink-0" />
                  {breadcrumbs.map((crumb, index) => (
                    <div key={crumb.path} className="flex items-center min-w-0">
                      {index > 0 && <FaChevronRight className="w-3 h-3 mx-2 flex-shrink-0" />}
                      <a
                        href={crumb.path}
                        className="hover:text-blue-600 transition-colors truncate"
                      >
                        {crumb.name}
                      </a>
                    </div>
                  ))}
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                  Blog Admin Panel
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 truncate">
                  {user?.role?.toLowerCase() === 'user' 
                    ? 'Access your content dashboard'
                    : 'Manage blog content and users'
                  }
                </p>
              </div>
              
              <div className="flex items-center space-x-2 flex-shrink-0">
                {/* User Info - Hidden on mobile, shown on tablet */}
                <div className="hidden md:flex items-center space-x-2 bg-gray-100 rounded-lg px-3 py-2">
                  <FaUser className="text-gray-500 w-4 h-4" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 truncate">{user.username}</p>
                    <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                  </div>
                </div>

                {/* Mobile User Menu Dropdown */}
                <div className="md:hidden relative mobile-user-menu">
                  <button
                    onClick={() => setMobileUserMenuOpen(!mobileUserMenuOpen)}
                    className="mobile-user-menu-trigger flex items-center p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <FaUser className="w-4 h-4 text-gray-600" />
                    <FaChevronDown className={`w-3 h-3 ml-1 text-gray-600 transition-transform ${mobileUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {mobileUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900 truncate">{user.username}</p>
                        <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                      </div>
                      <a
                        href="/blogs"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setMobileUserMenuOpen(false)}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <FaBlog className="w-4 h-4 mr-3" />
                        View Blog
                      </a>
                      {user && userHasRole(user.role, ['admin', 'superadmin']) && (
                        <a
                          href="/blog-admin/users"
                          onClick={() => setMobileUserMenuOpen(false)}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <FaUserCog className="w-4 h-4 mr-3" />
                          User Management
                        </a>
                      )}
                      <button
                        onClick={() => {
                          setMobileUserMenuOpen(false);
                          handleLogout();
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <FaSignOutAlt className="w-4 h-4 mr-3" />
                        Logout
                      </button>
                    </div>
                  )}
                </div>

                {/* Tablet Quick Actions - Hidden on mobile */}
                <div className="hidden md:flex lg:hidden items-center space-x-2">
                  <a
                    href="/blogs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <FaBlog className="mr-2 w-4 h-4" />
                    View Blog
                  </a>

               

                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 transition-colors"
                  >
                    <FaSignOutAlt className="mr-2 w-4 h-4" />
                    Logout
                  </button>
                </div>

                {/* Backend Status - Hidden on smaller screens */}
                <div className="hidden lg:flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    connectionStatus?.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm text-gray-500">
                    {connectionStatus?.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile & Tablet Navigation Bar */}
          <div className="border-t border-gray-200 bg-gray-50 px-4 sm:px-6 py-2">
            <div className="flex items-center justify-center">
              <nav className="flex space-x-1 sm:space-x-2">
                {visibleNavItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className={`flex items-center px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                        isActive 
                          ? 'bg-blue-100 text-blue-700 shadow-sm' 
                          : 'text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm'
                      }`}
                    >
                      <span className="mr-1 sm:mr-2">
                        {item.icon}
                      </span>
                      <span className="hidden sm:inline">{item.name}</span>
                      <span className="sm:hidden">
                        {item.name.split(' ')[0]}
                      </span>
                    </a>
                  );
                })}
              </nav>
            </div>
          </div>
        </header>

        {/* Mobile & Tablet Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 min-h-0">
          <div className="p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">
              {/* Connection Warning */}
              {connectionStatus && !connectionStatus.connected && (
                <div className="mb-4 sm:mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-3 sm:p-4 rounded-md">
                  <div className="flex">
                    <FaExclamationTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400 mr-2 sm:mr-3 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-yellow-800">Backend Connection Issue</h3>
                      <p className="text-xs sm:text-sm text-yellow-700 mt-1">
                        {connectionStatus.message}. Some features may not work properly.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Role-based message for users */}
              {user && user.role?.toLowerCase() === 'user' && (
                <div className="mb-4 sm:mb-6 bg-blue-50 border-l-4 border-blue-400 p-3 sm:p-4 rounded-md">
                  <div className="flex">
                    <FaUser className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400 mr-2 sm:mr-3 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-blue-800">User Access</h3>
                      <p className="text-xs sm:text-sm text-blue-700 mt-1">
                        You have user-level access. User Management features are available to admins only.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Main Content */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                {children}
              </div>
            </div>
          </div>
        </main>

        {/* Mobile & Tablet Footer */}
        <footer className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-center text-xs sm:text-sm text-gray-500 space-y-2 sm:space-y-0">
              <div>
                <p>© 2025 Blog Admin Panel. Connected to Express Backend.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center space-y-1 sm:space-y-0 sm:space-x-4">
                <span className="hidden sm:inline">
                  Last Login: {user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'N/A'}
                </span>
                <span className={`flex items-center ${connectionStatus?.connected ? 'text-green-500' : 'text-red-500'}`}>
                  <span className="w-2 h-2 rounded-full bg-current mr-1"></span>
                  {connectionStatus?.connected ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default BlogAdminLayout;