'use client';
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from '@context/AuthContext';

const BLOG_ROLES = { SUPERADMIN: 'superadmin', ADMIN: 'admin', USER: 'user' };
const ROLE_PERMISSIONS = {
  superadmin: ['*'],
  admin: [
    'dashboard','posts','posts:create','posts:read','posts:edit','posts:delete','posts:publish',
    'categories','categories:create','categories:edit','categories:delete','users:read','users:create','users:edit','users:delete','settings:read'
  ],
  user: [
    'dashboard','posts:read','posts:create','posts:edit:own','posts:delete:own','posts:publish:own',
    'categories:read','users:read:own'
  ]
};
const permissionHierarchy = {
  'posts:delete': ['posts:edit','posts:read'],
  'posts:delete:own': ['posts:edit:own','posts:read'],
  'posts:edit': ['posts:read'],
  'posts:edit:own': ['posts:read'],
  'posts:publish': ['posts:edit','posts:read'],
  'posts:publish:own': ['posts:edit:own','posts:read'],
  'categories:delete': ['categories:edit','categories:read'],
  'categories:edit': ['categories:read']
};

function hasBlogPermission(requiredPermission, userRole, userId=null, resourceOwnerId=null) {
  if (!userRole) return false;
  const role = userRole.toLowerCase();
  if (role === BLOG_ROLES.SUPERADMIN) return true;
  const perms = ROLE_PERMISSIONS[role]||[];
  if (perms.includes('*') || perms.includes(requiredPermission)) return true;
  if (requiredPermission.endsWith(':own') && userId && resourceOwnerId) {
    return perms.includes(requiredPermission) && userId.toString()===resourceOwnerId.toString();
  }
  if (permissionHierarchy[requiredPermission]) {
    return permissionHierarchy[requiredPermission].some(p=>perms.includes(p));
  }
  return false;
}

function getCurrentBlogRole(user) {
  if (user?.role) return user.role.toLowerCase();
  if (typeof window!=='undefined') {
    return localStorage.getItem('blogAdminRole')||localStorage.getItem('adminRole')||'';
  }
  return '';
}

const BlogAccessControl = ({
  children,
  requiredPermission,
  resourceOwnerId=null,
  validateWithBackend=true,
  fallback=null,
  showLoading=true
}) => {
  const router = useRouter();
  const { user, loading, isAuthenticated } = useAuth();
  const [contextError, setContextError] = useState(null);
  const [isValidating, setIsValidating] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [validationError, setValidationError] = useState(null);

  // Wrap checkAccess in useCallback so useEffect deps can include it
  const checkAccess = useCallback(async () => {
    setIsValidating(true);
    setValidationError(null);
    setHasAccess(false);
    try {
      if (!user || loading || !isAuthenticated()) {
        setValidationError('Authentication required');
        return;
      }
      if (user.isActive===false) {
        setValidationError('Account inactive');
        return;
      }
      const role = getCurrentBlogRole(user);
      const localOk = hasBlogPermission(requiredPermission, role, user.id, resourceOwnerId);
      if (!localOk) {
        setValidationError(
          requiredPermission.includes(':own') &&user.id.toString()!==`${resourceOwnerId}`
            ? 'ownership_required'
            : 'insufficient_permissions'
        );
        return;
      }
      if (validateWithBackend && ['admin','superadmin'].includes(role)) {
        const token = localStorage.getItem('adminToken');
        if (token) {
          const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL||'http://localhost:5002'}/api/auth/validate-token`, {
            headers:{ Authorization:`Bearer ${token}` }
          });
          if (!res.ok) {
            setValidationError('session_expired');
            return;
          }
          const backendUser = await res.json();
          if (backendUser.role.toLowerCase()!==role) {
            setValidationError('role_verification_failed');
            return;
          }
          if (!hasBlogPermission(requiredPermission, backendUser.role.toLowerCase(), backendUser.id, resourceOwnerId)) {
            setValidationError('backend_permission_denied');
            return;
          }
        }
      }
      setHasAccess(true);
    } catch (err) {
      console.error(err);
      setValidationError('permission_validation_failed');
    } finally {
      setIsValidating(false);
    }
  }, [user, loading, isAuthenticated, requiredPermission, resourceOwnerId, validateWithBackend]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  if (loading||isValidating) {
    return showLoading ? (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-12 w-12 border-t-2 border-blue-500"></div>
      </div>
    ) : null;
  }
  if (!hasAccess) {
    if (fallback) return fallback;
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
        <p className="mb-4">
          {validationError==='ownership_required'
            ?"You can only manage your own posts."
            :"You don’t have permission to view this."}
        </p>
        <button onClick={()=>router.back()} className="px-4 py-2 bg-blue-600 text-white rounded">
          Go Back
        </button>
      </div>
    );
  }
  return <>{children}</>;
};

export default BlogAccessControl;
export {
  hasBlogPermission,
  getCurrentBlogRole,
  BLOG_ROLES
};
