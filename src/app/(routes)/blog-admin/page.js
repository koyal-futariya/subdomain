"use client";

import { useState, useEffect } from "react";
import { FaPlus, FaEdit, FaTrash, FaSearch, FaSpinner, FaExclamationTriangle, FaBlog, FaUser, FaEye, FaTimes, FaFilter } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import CreateBlogPost from "../../components/BlogsPage/CreateBlogPost";
import ProtectedPage from "../../components/blog-admin/ProtectedPage";

// Backend API base URL - Update this to match your backend
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5002";

const BlogsAdminPanel = () => {
  const { user, isAuthenticated } = useAuth();
  const canCreate = true;
  const canEdit = true;
  const canDelete = true;

  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingBlog, setEditingBlog] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalBlogs, setTotalBlogs] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false); // Mobile filter toggle

  // Enhanced stats state
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    drafts: 0,
    featured: 0,
  });

  const categories = [
    "Technology",
    "Business",
    "Marketing",
    "Development",
    "Design",
    "Analytics",
    "AI/ML",
    "Cloud Computing",
    "Lifestyle",
    "Health",
    "Travel",
    "Food",
  ];

  const statuses = ["None", "Trending", "Featured", "Editor's Pick", "Recommended"];

  // Reusable logout handler: clears tokens and replaces history to login
  const handleLogout = async () => {
    try {
      // Optional: call backend logout if available
      // await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});

      // Clear blogs namespace
      localStorage.removeItem("blogToken");
      localStorage.removeItem("blogsToken");
      localStorage.removeItem("blogsRole");
      localStorage.removeItem("blogsUser");

      // Clear generic/admin keys
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminRole");
      localStorage.removeItem("adminUsername");
      localStorage.removeItem("adminEmail");
      localStorage.removeItem("adminId");
      localStorage.removeItem("isAdminLoggedIn");
      localStorage.removeItem("userData");
    } catch (e) {
      // ignore
    } finally {
      // Replace current entry so back won't return here
      window.location.replace("/AdminLogin?logout=1");
    }
  };

  // Intercept browser Back to perform logout (no pushState buffer to avoid loops)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPopState = () => {
      handleLogout();
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []); // mount once [12]

  // Calculate stats for all blogs
  const calculateBlogStats = (blogsData) => {
    const newStats = {
      total: blogsData.length,
      published: blogsData.filter((blog) => blog.status && blog.status !== "None").length,
      drafts: blogsData.filter((blog) => !blog.status || blog.status === "None").length,
      featured: blogsData.filter((blog) => ["Featured", "Editor's Pick", "Trending"].includes(blog.status)).length,
    };

    setStats(newStats);
    return blogsData;
  };

  useEffect(() => {
    if (isAuthenticated() && user) {
      fetchBlogs();
    }
  }, [isAuthenticated, user]);

  const fetchBlogs = async (reset = true, showLoader = true) => {
    // Check authentication status and get token
    let token = localStorage.getItem("blogToken") || localStorage.getItem("adminToken");

    // If not authenticated and no token, redirect to login
    if ((!isAuthenticated() || !user) && !token) {
      window.location.replace("/AdminLogin?redirect=/blog-admin");
      return;
    }

    // If we have a token but no user, try to validate it
    if (token && (!user || !isAuthenticated())) {
      try {
        const response = await fetch(`${API_BASE}/api/auth/validate-token`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error("Invalid token");

        const userData = await response.json();
        if (window.loginFromProtectedPage) {
          window.loginFromProtectedPage(userData);
        }
        return;
      } catch (error) {
        localStorage.removeItem("blogToken");
        localStorage.removeItem("adminToken");
        window.location.replace("/AdminLogin?session=expired");
        return;
      }
    }

    if (!user) {
      setError("Failed to load user information. Please try again.");
      return;
    }

    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      token = localStorage.getItem("blogToken") || localStorage.getItem("adminToken");
      if (!token) {
        throw new Error("No authentication token available");
      }

      token = token.trim().replace(/^Bearer\s*/i, "");

      if (!token) {
        throw new Error("Invalid authentication token. Please login again.");
      }

      const params = new URLSearchParams();
      params.append("limit", "50");
      params.append("skip", reset ? "0" : String(currentPage * 50));

      if (filterCategory && filterCategory.trim()) {
        params.append("category", filterCategory.trim());
      }
      if (filterStatus && filterStatus.trim() && filterStatus !== "None") {
        params.append("status", filterStatus.trim());
      }
      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      if (user && user.role && user.role.toLowerCase() === "user") {
        params.append("authorId", user.id);
      }

      const endpoint = `${API_BASE}/api/blogs`;
      const requestUrl = `${endpoint}?${params}`;

      let response;

      try {
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };

        response = await fetch(requestUrl, {
          method: "GET",
          headers,
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem("blogToken");
            localStorage.removeItem("adminToken");
            window.location.replace("/AdminLogin");
            return;
          }
          const errorText = await response.text().catch(() => "Failed to read error response");
          throw new Error(`Request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }
      } catch (firstError) {
        try {
          response = await fetch(requestUrl, {
            method: "GET",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
            credentials: "include",
          });

          if (!response.ok) {
            throw new Error("Raw token attempt failed");
          }
        } catch (secondError) {
          throw new Error("Failed to authenticate with the server. Please try logging in again.");
        }
      }

      if (!response.ok) {
        let errorData;
        let errorText;

        try {
          errorText = await response.text();
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            errorData = { message: errorText };
          }

          if (response.status === 401) {
            localStorage.removeItem("adminToken");
            localStorage.removeItem("blogToken");
            throw new Error("Authentication failed. Please login again.");
          } else if (response.status === 400) {
            throw new Error(errorData.message || "Invalid request. Please check your input and try again.");
          } else {
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
          }
        } catch (error) {
          throw error;
        }
      }

      const data = await response.json();
      let blogsData = data.blogs || data || [];
      const hasMoreData = data.hasMore || false;

      if (user && user.role && user.role.toLowerCase() === "user") {
        blogsData = blogsData.filter(
          (blog) =>
            blog.author === user.id ||
            (blog.author && blog.author._id === user.id) ||
            blog.authorId === user.id
        );
      }

      const filteredBlogsData = calculateBlogStats(blogsData);

      if (reset) {
        setBlogs(filteredBlogsData);
        setCurrentPage(1);
      } else {
        setBlogs((prev) => [...prev, ...filteredBlogsData]);
        setCurrentPage((prev) => prev + 1);
      }

      setHasMore(hasMoreData);
      setTotalBlogs(filteredBlogsData.length);
    } catch (error) {
      setError(error.message || "Failed to load blogs");
      setBlogs([]);
      setStats({ total: 0, published: 0, drafts: 0, featured: 0 });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSaveBlog = async (blogData) => {
    try {
      setLoading(true);

      const token = localStorage.getItem("adminToken") || localStorage.getItem("blogToken");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const formData = new FormData();

      const fieldMappings = {
        urlSlug: "slug",
        authorName: "author",
        blogImage: "image",
      };

      Object.keys(blogData).forEach((key) => {
        const backendFieldName = fieldMappings[key] || key;
        if (blogData[key] !== null && blogData[key] !== "" && blogData[key] !== undefined) {
          if (key === "blogImage" && blogData[key] instanceof File) {
            formData.append("image", blogData[key]);
          } else if (key !== "blogImage" && key !== "imagePreview" && key !== "_id") {
            formData.append(backendFieldName, blogData[key]);
          }
        }
      });

      if (!formData.get("author")) {
        formData.append("author", (user && user.username) || "Admin");
      }

      if (editingBlog && user && user.role && user.role.toLowerCase() === "user") {
        const canEditThisPost =
          editingBlog.author === user.username ||
          editingBlog.authorId === user.id ||
          editingBlog.createdBy === user.id;

        if (!canEditThisPost) {
          throw new Error("You can only edit your own posts");
        }
      }

      let url = `${API_BASE}/api/blogs`;
      let method = "POST";

      if (editingBlog && blogData._id) {
        url = `${API_BASE}/api/blogs/${blogData._id}`;
        method = "PUT";
      }

      const tokenHeader = (localStorage.getItem("adminToken") || localStorage.getItem("blogToken") || "").replace(
        /^Bearer\s*/i,
        ""
      );

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${tokenHeader}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to save blog");
      }

      const responseData = await response.json();
      await fetchBlogs(true, false);

      setShowCreateModal(false);
      setEditingBlog(null);

      const message = editingBlog ? "Blog updated successfully!" : "Blog created successfully!";
      showNotification(message, "success");
    } catch (error) {
      setError(error.message || "Failed to save blog");
      showNotification(`Error: ${error.message || "Failed to save blog"}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (blog) => {
    setEditingBlog(blog);
    setShowCreateModal(true);
  };

  const handleDelete = async (blogId, blog) => {
    if (!confirm("Are you sure you want to delete this blog? This action cannot be undone.")) {
      return;
    }

    try {
      setLoading(true);

      const token = localStorage.getItem("adminToken") || localStorage.getItem("blogToken");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const tokenHeader = token.replace(/^Bearer\s*/i, "");

      const response = await fetch(`${API_BASE}/api/blogs/${blogId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenHeader}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || "Failed to delete blog");
      }

      showNotification("Blog deleted successfully!", "success");

      await fetchBlogs(true, false);
    } catch (error) {
      setError(error.message || "Failed to delete blog");
      showNotification(`Error: ${error.message || "Failed to delete blog"}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = "success") => {
    const notification = document.createElement("div");
    const bgColor = type === "success" ? "bg-green-500" : "bg-red-500";
    notification.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity duration-300`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, type === "success" ? 3000 : 5000);
  };

  const openCreateModal = () => {
    setEditingBlog(null);
    setShowCreateModal(true);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingBlog(null);
    setError(null);
  };

  const handleFilterChange = async () => {
    setCurrentPage(0);
    await fetchBlogs(true, false);
  };

  const handleRefresh = async () => {
    await fetchBlogs(true, false);
  };

  useEffect(() => {
    if (isAuthenticated()) {
      const debounceTimer = setTimeout(() => {
        handleFilterChange();
      }, 500);

      return () => clearTimeout(debounceTimer);
    }
  }, [filterCategory, filterStatus, searchTerm]);

  const filteredBlogs = blogs.filter((blog) => {
    if (!blog) return false;

    const matchesSearch =
      searchTerm === "" ||
      (blog.title && blog.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (blog.content && blog.content.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (blog.author && blog.author.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesSearch;
  });

  if (error && !loading && blogs.length === 0) {
    return (
      <ProtectedPage requiredRoles={["admin", "superadmin", "user"]} pageTitle="Blog Management">
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 sm:p-6">
          <div className="bg-red-50 border-l-4 border-red-500 p-4 sm:p-6 w-full max-w-2xl rounded-md shadow">
            <div className="flex flex-col sm:flex-row">
              <FaExclamationTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 mb-4 sm:mb-0 sm:mr-4 mx-auto sm:mx-0" />
              <div className="text-center sm:text-left">
                <h3 className="text-lg sm:text-xl font-bold text-red-800 mb-2">Error Loading Blogs</h3>
                <p className="text-red-700 mb-4 text-sm sm:text-base">{error}</p>
                <button
                  onClick={() => fetchBlogs()}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors w-full sm:w-auto"
                  disabled={loading}
                >
                  {loading ? <FaSpinner className="animate-spin inline mr-2" /> : ""}
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage requiredRoles={["admin", "superadmin", "user"]} pageTitle="Blog Management">
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-0">
        {/* Create/Edit Blog Post Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-lg w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl">
              <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg sm:text-2xl font-bold text-gray-800 flex items-center">
                  {editingBlog ? (
                    <>
                      <FaEdit className="mr-2 sm:mr-3 text-blue-600" />
                      <span className="hidden sm:inline">Edit Blog Post</span>
                      <span className="sm:hidden">Edit Post</span>
                    </>
                  ) : (
                    <>
                      <FaPlus className="mr-2 sm:mr-3 text-green-600" />
                      <span className="hidden sm:inline">Create New Blog Post</span>
                      <span className="sm:hidden">Create Post</span>
                    </>
                  )}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-200 rounded-full"
                  disabled={loading}
                >
                  <FaTimes className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>

              <div className="overflow-y-auto max-h-[calc(95vh-80px)] sm:max-h-[calc(90vh-80px)]">
                <CreateBlogPost onSave={handleSaveBlog} initialData={editingBlog || {}} isModal={true} onCancel={closeModal} />
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Enhanced Header with Stats */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
              <div className="text-center sm:text-left">
                <h2 className="text-xl sm:text-2xl font-bold mb-2 flex items-center justify-center sm:justify-start">
                  <FaBlog className="mr-2 sm:mr-3" />
                  <span className="hidden sm:inline">{user && user.role && user.role.toLowerCase() === "user" ? "My Blog Posts" : "Manage Blog Posts"}</span>
                  <span className="sm:hidden">{user && user.role && user.role.toLowerCase() === "user" ? "My Posts" : "Manage Posts"}</span>
                </h2>
                <p className="hidden md:block text-blue-100 text-sm sm:text-base">
                  {user && user.role && user.role.toLowerCase() === "user" ? "Create and manage your blog content" : "Create, edit, and manage blog content"}
                </p>
              </div>

              {/* Logout button wired to same handler as back */}
              <div className="mt-3 sm:mt-0">
                <button onClick={handleLogout} className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors" title="Logout">
                  <FaTimes className="w-3 h-3" />
                  Logout
                </button>
              </div>
            </div>

            {/* Enhanced Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mt-4">
              <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-2 sm:p-3 text-center hover:bg-opacity-20 transition-all duration-200">
                <div className="text-lg sm:text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-blue-100">Total</div>
              </div>
              <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-2 sm:p-3 text-center hover:bg-opacity-20 transition-all duration-200">
                <div className="text-lg sm:text-2xl font-bold text-green-200">{stats.published}</div>
                <div className="text-xs text-blue-100">Published</div>
              </div>
              <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-2 sm:p-3 text-center hover:bg-opacity-20 transition-all duration-200">
                <div className="text-lg sm:text-2xl font-bold text-yellow-200">{stats.drafts}</div>
                <div className="text-xs text-blue-100">Drafts</div>
              </div>
              <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-2 sm:p-3 text-center hover:bg-opacity-20 transition-all duration-200">
                <div className="text-lg sm:text-2xl font-bold text-purple-200">{stats.featured}</div>
                <div className="text-xs text-blue-100">Featured</div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="p-4 sm:p-6 border-b bg-gray-50">
            {/* Mobile-first layout */}
            <div className="space-y-4">
              {/* Top row: Create button and user info */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {canCreate && (
                    <button
                      onClick={openCreateModal}
                      disabled={loading}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 sm:py-2 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm sm:text-base font-medium"
                    >
                      {loading ? <FaSpinner className="animate-spin" /> : <FaPlus />}
                      <span className="sm:hidden">New Blog</span>
                      <span className="hidden sm:inline">Create New Blog</span>
                    </button>
                  )}

                  <div className="text-xs sm:text-sm text-gray-600 flex items-center justify-center sm:justify-start gap-2 bg-white px-3 py-2 rounded-lg border">
                    <FaUser className="text-blue-500" />
                    <span>
                      Role: <span className="font-medium capitalize">{user && user.role}</span>
                    </span>
                    {user && user.role && user.role.toLowerCase() === "user" && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">Your Posts Only</span>}
                  </div>
                </div>

                {/* Filter toggle for mobile */}
                <button onClick={() => setShowFilters(!showFilters)} className="sm:hidden bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors">
                  <FaFilter />
                  {showFilters ? "Hide Filters" : "Show Filters"}
                </button>
              </div>

              {/* Search and filters */}
              <div className={`space-y-3 sm:space-y-0 ${showFilters ? "block" : "hidden sm:block"}`}>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  {/* Search */}
                  <div className="relative flex-1 sm:flex-initial">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search blogs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 sm:py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64 shadow-sm text-sm sm:text-base"
                      disabled={loading}
                    />
                  </div>

                  {/* Category Filter */}
                  <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 sm:px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 shadow-sm text-sm sm:text-base" disabled={loading}>
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  {/* Status Filter */}
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 sm:px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 shadow-sm text-sm sm:text-base" disabled={loading}>
                    <option value="">All Statuses</option>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
                <FaExclamationTriangle className="text-red-500 flex-shrink-0 mt-0.5" />
                <span className="flex-1 text-sm">{error}</span>
                <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 flex-shrink-0">
                  <FaTimes />
                </button>
              </div>
            )}
          </div>

          {/* Blog List */}
          <div className="p-4 sm:p-6">
            {loading && blogs.length === 0 ? (
              <div className="flex justify-center items-center py-12">
                <div className="text-center">
                  <FaSpinner className="animate-spin text-3xl sm:text-4xl text-blue-600 mb-4 mx-auto" />
                  <p className="text-gray-600 text-sm sm:text-base">Loading your blogs...</p>
                </div>
              </div>
            ) : filteredBlogs.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <div className="text-gray-400 mb-4">
                  <FaBlog className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4" />
                </div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">{blogs.length === 0 ? "No blog posts yet" : "No posts match your search"}</h3>
                <p className="text-gray-500 mb-4 text-sm sm:text-base px-4">
                  {blogs.length === 0 ? (user && user.role && user.role.toLowerCase() === "user" ? "Get started by creating your first blog post" : "Get started by creating blog posts") : "Try adjusting your search terms or filters"}
                </p>
                {canCreate && blogs.length === 0 && (
                  <button onClick={openCreateModal} className="bg-green-600 hover:bg-green-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg transition-colors inline-flex items-center gap-2 shadow-sm text-sm sm:text-base">
                    <FaPlus />
                    Create Your First Blog
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {filteredBlogs.map((blog) => (
                  <div
                    key={blog._id}
                    className={`border rounded-lg p-4 sm:p-6 hover:shadow-md transition-all duration-200 bg-white ${
                      user && user.role && user.role.toLowerCase() === "user" && blog.author === (user.username || "")
                        ? "border-l-4 border-l-blue-500 bg-blue-50"
                        : "hover:border-gray-300"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 space-y-4 sm:space-y-0">
                      <div className="flex-1 sm:mr-4">
                        <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 line-clamp-2 hover:text-blue-600 transition-colors">{blog.title}</h3>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs sm:text-sm font-medium">{blog.category}</span>
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs sm:text-sm font-medium">{blog.subcategory}</span>
                          {blog.status !== "None" && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs sm:text-sm font-medium">{blog.status}</span>}
                          {user && user.role && user.role.toLowerCase() === "user" && blog.author === (user.username || "") && (
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs sm:text-sm font-medium flex items-center gap-1">
                              <FaUser className="w-3 h-3" />
                              Your Post
                            </span>
                          )}
                        </div>

                        {/* Mobile-optimized blog details */}
                        <div className="text-gray-600 text-xs sm:text-sm space-y-1">
                          <p>
                            <strong>Author:</strong> {blog.author} {user && blog.author === user.username && <span className="text-blue-600 font-medium">(You)</span>}
                          </p>
                          <p>
                            <strong>Created:</strong> {new Date(blog.createdAt).toLocaleDateString()}
                          </p>
                          <p className="hidden sm:block">
                            <strong>Updated:</strong> {new Date(blog.updatedAt).toLocaleDateString()}
                          </p>
                          <p className="hidden sm:block">
                            <strong>Slug:</strong> <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">/{blog.slug}</code>
                          </p>
                        </div>

                        {blog.content && <p className="text-gray-700 mt-3 text-xs sm:text-sm line-clamp-2">{blog.content.replace(/<[^>]*>/g, "").substring(0, 100)}...</p>}
                      </div>

                      {blog.image && (
                        <div className="flex justify-center sm:justify-end">
                          <img
                            src={blog.image}
                            alt={blog.title}
                            className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg border shadow-sm hover:shadow-md transition-shadow"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-100">
                      <div className="flex gap-2 flex-1">
                        {canEdit && (
                          <button onClick={() => handleEdit(blog)} disabled={loading} className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-xs sm:text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                            <FaEdit className="w-3 h-3" /> Edit
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(blog._id, blog)} disabled={loading} className="flex-1 sm:flex-initial bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-xs sm:text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                            <FaTrash className="w-3 h-3" /> Delete
                          </button>
                        )}
                      </div>
                      <a href={`/blogs/${blog.category ? blog.category.toLowerCase() : ""}/${blog.slug}`} target="_blank" rel="noopener noreferrer" className="flex-1 sm:flex-initial bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-xs sm:text-sm transition-colors shadow-sm">
                        <FaEye className="w-3 h-3" /> View Live
                      </a>
                    </div>
                  </div>
                ))}

                {/* Load More Button */}
                {hasMore && (
                  <div className="text-center pt-4 sm:pt-6">
                    <button onClick={() => fetchBlogs(false)} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg transition-colors disabled:opacity-50 shadow-sm text-sm sm:text-base w-full sm:w-auto">
                      {loading ? <FaSpinner className="animate-spin inline mr-2" /> : ""}
                      Load More Posts
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedPage>
  );
};

export default BlogsAdminPanel;
