'use client';

import React, { useState, useEffect, useContext } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthContext, useAuth } from '../../context/AuthContext';
import { Upload, User, Save, Eye, Image as ImageIcon, X, Plus, Hash, Calendar, Camera, Edit } from 'lucide-react';

// Backend base URL - should match your Express server
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

// Match backend slugification
const slugify = (text = '') =>
  text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');

const subcategoryOptions = ['Article', 'Tutorial', 'Interview Questions'];
const statusOptions = ['None', 'Trending', 'Featured', "Editor's Pick", 'Recommended'];

// Shared Tailwind utility presets for consistent inputs/labels/help
const fieldBase =
  'w-full rounded-xl border border-gray-200 bg-white/80 text-gray-900 placeholder-gray-400 ' +
  'ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed transition-shadow';

const labelBase = 'block text-sm font-semibold text-gray-800 mb-2';
const helpText = 'text-xs text-gray-500 mt-1';

export default function CreateBlogPost({
  onSave,
  initialData = {},
  isModal = false,
  onCancel
}) {
  const [formData, setFormData] = useState({
    title: '',
    urlSlug: '',
    content: '',
    category: '',
    subcategory: 'Article',
    authorName: '',
    status: 'None',
    blogImage: null
  });

  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [blogId, setBlogId] = useState(null);
  const [existingImageUrl, setExistingImageUrl] = useState(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const authContext = useContext(AuthContext);
  const { user } = authContext || {};

  // Initialize with initialData (for modal mode) or URL params (for standalone mode)
  useEffect(() => {
    if (isModal && initialData && Object.keys(initialData).length > 0) {
      // Modal mode with initial data (editing)
      setIsEditMode(true);
      setBlogId(initialData._id);
      populateFormData(initialData);
    } else if (!isModal) {
      // Standalone mode - check URL params
      const id = searchParams?.get('id');
      const mode = searchParams?.get('mode');

      if (id && mode === 'edit') {
        setIsEditMode(true);
        setBlogId(id);
        fetchBlogData(id);
      }
    }
  }, [initialData, searchParams, isModal]);

  // Populate form with existing data
  const populateFormData = (blog) => {
    setFormData({
      title: blog.title || '',
      urlSlug: blog.slug || '',
      content: blog.content || '',
      category: blog.category || '',
      subcategory: blog.subcategory || 'Article',
      authorName: blog.author || '',
      status: blog.status || 'None',
      blogImage: null
    });

    if (blog.image) {
      setExistingImageUrl(blog.image);
      setPreviewImage(blog.image);
    }
  };

  // Fetch blog data for URL-based editing
  const fetchBlogData = async (id) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('adminToken') || localStorage.getItem('blogToken');

      if (!token) {
        router.push('/AdminLogin');
        return;
      }

      const response = await fetch(`${API_BASE}/api/blogs/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('blogToken');
          router.push('/AdminLogin');
          return;
        }
        throw new Error('Failed to fetch blog data');
      }

      const blog = await response.json();
      populateFormData(blog);
    } catch (err) {
      console.error('Error fetching blog data:', err);
      setError('Failed to load blog data for editing');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-save simulation
  useEffect(() => {
    const interval = setInterval(() => {
      if (formData.title || formData.content) {
        setIsAutoSaving(true);
        setTimeout(() => setIsAutoSaving(false), 1000);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [formData]);

  // Auto-generate URL slug from title (only for new blogs)
  useEffect(() => {
    if (!isEditMode && formData.title) {
      setFormData((prev) => ({ ...prev, urlSlug: slugify(formData.title) }));
    } else if (!isEditMode) {
      setFormData((prev) => ({ ...prev, urlSlug: '' }));
    }
  }, [formData.title, isEditMode]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files) {
      const file = e.dataTransfer.files;
      if (file.type.startsWith('image/')) {
        handleImageUpload(file);
      } else {
        setError('Only image files are allowed.');
      }
    }
  };

  const handleImageUpload = (file) => {
    // Validate file size (e.g., 5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target.result);
      setFormData((prev) => ({ ...prev, blogImage: file }));
      setExistingImageUrl(null);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files) {
      handleImageUpload(e.target.files);
    }
  };

  const removeImage = () => {
    setPreviewImage(null);
    setExistingImageUrl(null);
    setFormData((prev) => ({ ...prev, blogImage: null }));
  };

  const showNotification = (message, type = 'success') => {
    if (isModal) {
      // For modal mode, don't create notifications as parent handles them
      return;
    }

    const notification = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    notification.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity duration-300`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, type === 'success' ? 3000 : 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (isModal && onSave) {
        // Modal mode - use parent's onSave function
        await onSave({
          ...formData,
          _id: blogId // Include ID for editing
        });
      } else {
        // Standalone mode - handle save directly
        const token = localStorage.getItem('adminToken') || localStorage.getItem('blogToken');
        if (!token) {
          router.push('/AdminLogin');
          return;
        }

        if (!user) {
          setError('User not authenticated. Please log in again.');
          return;
        }

        // Build FormData for backend
        const form = new FormData();

        // Map frontend fields to backend fields
        form.append('title', formData.title);
        form.append('content', formData.content);
        form.append('category', formData.category);
        form.append('subcategory', formData.subcategory);
        form.append('author', formData.authorName || user.username || 'Admin');
        form.append('status', formData.status);

        if (formData.urlSlug) form.append('slug', formData.urlSlug);
        if (formData.blogImage) form.append('image', formData.blogImage);

        // API endpoint and method
        const url = isEditMode ? `${API_BASE}/api/blogs/${blogId}` : `${API_BASE}/api/blogs`;
        const method = isEditMode ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`
            // Don't set Content-Type for FormData - browser will set it with boundary
          },
          body: form
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 409) {
            throw new Error(errorData.message || 'Slug already exists. Please adjust the title or slug.');
          }
          if (response.status === 401) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('blogToken');
            router.push('/AdminLogin');
            return;
          }
          throw new Error(errorData.message || `Failed to ${isEditMode ? 'update' : 'create'} blog post`);
        }

        const responseData = await response.json();
        console.log('Blog saved successfully:', responseData);

        const successMessage = `Blog post ${isEditMode ? 'updated' : 'created'} successfully!`;
        showNotification(successMessage, 'success');

        if (!isEditMode) {
          // Reset form for new posts
          setFormData({
            title: '',
            urlSlug: '',
            content: '',
            category: '',
            subcategory: 'Article',
            authorName: '',
            status: 'None',
            blogImage: null
          });
          setPreviewImage(null);
          setExistingImageUrl(null);
        } else {
          // Optionally navigate or keep editing
        }
      }
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} blog post:`, err);
      const errorMessage = err.message || `Failed to ${isEditMode ? 'update' : 'create'} blog post`;
      setError(errorMessage);
      showNotification(errorMessage, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else if (!isModal) {
      router.back();
    }
  };

  const categories = [
    'Technology',
    'Business',
    'Marketing',
    'Development',
    'Design',
    'Analytics',
    'AI/ML',
    'Cloud Computing',
    'Lifestyle',
    'Health',
    'Travel',
    'Food'
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading blog data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={isModal ? 'w-full' : 'min-h-screen bg-gray-50'}>
      <div className={isModal ? 'w-full' : 'mx-auto w-full max-w-screen-2xl p-4 md:p-6 lg:p-8'}>
        <div className={isModal ? 'w-full' : 'grid grid-cols-1 lg:grid-cols-12 gap-6'}>
          {/* Form column */}
          <div className={`col-span-12 ${!isModal ? 'lg:col-span-7' : ''}`}>
            <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-gray-100">
              

              {/* Form */}
              <form id="blog-form" onSubmit={handleSubmit} className="p-4 md:p-6 lg:p-8 space-y-6 pb-28 sm:pb-0">
                {error && (
                  <div
                    className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg relative"
                    role="alert"
                  >
                    <span className="block sm:inline">{error}</span>
                    <button
                      type="button"
                      onClick={() => setError('')}
                      className="absolute top-2 right-2 text-red-600 hover:text-red-700"
                      aria-label="Dismiss error"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Blog Title */}
                <div className="group">
                  <label className={labelBase}>
                    <span className="inline-flex items-center">
                      <Hash className="w-4 h-4 mr-2 text-blue-600" />
                      Blog Title
                    </span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Enter blog title"
                    className={`${fieldBase} px-4 py-3 text-sm md:text-base`}
                    required
                    disabled={isSubmitting}
                    maxLength={200}
                    aria-describedby="title-help"
                  />
                  <p id="title-help" className={helpText}>
                    Aim for a concise, scannable headline under ~70 characters.
                  </p>
                </div>

                {/* URL Slug */}
                <div className="group">
                  <label className={labelBase}>URL Slug</label>
                  <input
                    type="text"
                    name="urlSlug"
                    value={formData.urlSlug}
                    onChange={handleInputChange}
                    placeholder={isEditMode ? 'Edit slug if needed' : 'Auto-generated from title'}
                    className={`${fieldBase} px-4 py-3 text-sm md:text-base ${!isEditMode ? 'bg-gray-50' : ''}`}
                    readOnly={!isEditMode}
                    maxLength={100}
                    aria-describedby="slug-help"
                  />
                  <p id="slug-help" className={helpText}>
                    Use lowercase-with-hyphens; keep it short and descriptive.
                  </p>
                </div>

                {/* Content */}
                <div className="group">
                  <label className={labelBase}>Content</label>
                  <div className="rounded-xl border border-gray-200 bg-white/80 ring-1 ring-gray-200 focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 transition-shadow">
                    <div className="bg-gray-50 px-3 md:px-4 py-2 border-b border-gray-200 flex flex-wrap gap-1 md:gap-2">
                      <button type="button" className="px-2 py-1 text-gray-700 hover:bg-gray-200 rounded font-bold">
                        B
                      </button>
                      <button type="button" className="px-2 py-1 text-gray-700 hover:bg-gray-200 rounded italic">
                        I
                      </button>
                      <button type="button" className="px-2 py-1 text-gray-700 hover:bg-gray-200 rounded underline">
                        U
                      </button>
                    </div>
                    <textarea
                      name="content"
                      value={formData.content}
                      onChange={handleInputChange}
                      placeholder="Type your blog content here..."
                      className="w-full px-4 py-3 border-0 focus:ring-0 resize-y min-h-[160px] text-sm md:text-base"
                      rows={6}
                      required
                      disabled={isSubmitting}
                      maxLength={10000}
                      aria-describedby="content-help"
                    />
                  </div>
                  <p id="content-help" className={helpText}>
                    Use short paragraphs and headings for readability on small screens.
                  </p>
                </div>

                {/* Category and Subcategory */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelBase}>Category</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className={`${fieldBase} px-4 py-3 text-sm md:text-base`}
                      required
                      disabled={isSubmitting}
                    >
                      <option value="">Select Category</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelBase}>Subcategory</label>
                    <select
                      name="subcategory"
                      value={formData.subcategory}
                      onChange={handleInputChange}
                      className={`${fieldBase} px-4 py-3 text-sm md:text-base`}
                      required
                      disabled={isSubmitting}
                      aria-describedby="subcat-help"
                    >
                      {subcategoryOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <p id="subcat-help" className={helpText}>
                      Must match backend enum values exactly.
                    </p>
                  </div>
                </div>

                {/* Author and Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`${labelBase} inline-flex items-center`}>
                      <User className="w-4 h-4 mr-2 text-blue-600" />
                      Author Name
                    </label>
                    <input
                      type="text"
                      name="authorName"
                      value={formData.authorName}
                      onChange={handleInputChange}
                      placeholder={user?.username || 'Enter author name'}
                      className={`${fieldBase} px-4 py-3 text-sm md:text-base`}
                      required
                      disabled={isSubmitting}
                      maxLength={50}
                    />
                  </div>
                  <div>
                    <label className={labelBase}>Status</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className={`${fieldBase} px-4 py-3 text-sm md:text-base`}
                      disabled={isSubmitting}
                      aria-describedby="status-help"
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <p id="status-help" className={helpText}>Display status used for highlighting, not publishing state.</p>
                  </div>
                </div>

                {/* Blog Image Upload */}
                <div className="mb-2">
                  <label className={`${labelBase} inline-flex items-center`}>
                    <Camera className="w-4 h-4 mr-2 text-blue-600" />
                    Blog Image
                  </label>
                  <div
                    className={`relative w-full min-h-[220px] rounded-xl p-4 flex items-center justify-center bg-white shadow-sm
                    border-2 border-dashed ${dragActive ? 'border-bluee-500 bg-blue-50' : 'border-gray-200'}
                    ring-1 ring-gray-200 focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2
                    transition-all`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    tabIndex={0}
                    role="button"
                    aria-label="Upload blog image"
                  >
                    {previewImage ? (
                      <div className="relative w-full">
                        <div className="aspect-video w-full bg-gray-100 rounded-lg overflow-hidden">
                          <img src={previewImage} alt="Preview" className="h-full w-full object-cover" />
                        </div>
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                          disabled={isSubmitting}
                          aria-label="Remove image"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        {isEditMode && existingImageUrl && !formData.blogImage && (
                          <p className="text-xs text-blue-600 mt-2">Current image (upload new to replace)</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full text-center">
                        <Upload className="w-12 h-12 text-gray-400 mb-3" />
                        <p className="text-gray-700 mb-2">
                          {isEditMode ? 'Upload new image or keep existing' : 'Drag & drop your image here, or'}
                        </p>
                        <label className="cursor-pointer inline-flex items-center justify-center rounded-lg px-3 py-2 bg-bluee-600 text-white font-medium hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
                          Browse
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileInput}
                            className="hidden"
                            disabled={isSubmitting}
                          />
                        </label>
                        <p className="text-xs text-gray-500 mt-2">PNG, JPG, GIF up to 5MB</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Desktop/tablet actions (inline) */}
                <div className="hidden sm:flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`flex-1 ${
                      isEditMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'
                    } text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200 disabled:opacity-70`}
                  >
                    {isSubmitting ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-5 w-5 text-white inline"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        {isEditMode ? 'Updating...' : 'Publishing...'}
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5 inline mr-2" />
                        {isEditMode ? 'Update Post' : 'Publish Now'}
                      </>
                    )}
                  </button>

                  {(isModal || onCancel) && (
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={isSubmitting}
                      className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {/* Mobile sticky bar spacer handled by pb-28 above */}
              </form>

              {/* Mobile sticky bar actions */}
              <div className="sm:hidden">
                <div className="fixed inset-x-0 bottom-0 z-40 bg-white/90 backdrop-blur border-t border-gray-200 p-3">
                  <div className="flex gap-2">
                    {(isModal || onCancel) && (
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      form="blog-form"
                      type="submit"
                      disabled={isSubmitting}
                      className={`flex-1 ${
                        isEditMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-bluee-600 hover:bg-blue-700'
                      } text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-70`}
                    >
                      {isSubmitting ? 'Saving...' : isEditMode ? 'Update' : 'Publish'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Preview column (standalone only) */}
          {!isModal && (
            <aside className="col-span-12 lg:col-span-5">
              <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-gray-100 p-4 md:p-6 lg:p-8 lg:sticky lg:top-6">
                <div className="flex items-center mb-6">
                  <Eye className="w-5 h-5 mr-2 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Preview</h3>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 min-h-48 flex flex-col">
                  <div className="w-full rounded-lg overflow-hidden mb-4 bg-gray-100">
                    <div className="aspect-video w-full">
                      {previewImage ? (
                        <img src={previewImage} alt="Blog preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-20 h-20 text-gray-300" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center text-sm text-gray-600 mb-4 flex-wrap gap-x-2">
                    <User className="w-5 h-5 mr-2" />
                    <span>{formData.authorName || user?.username || 'Author Name'}</span>
                    <span className="mx-1">•</span>
                    <Calendar className="w-5 h-5 mr-1" />
                    <span>{new Date().toLocaleDateString()}</span>
                    <span className="mx-1">•</span>
                    <span>5 min read</span>
                  </div>

                  <h4 className="font-bold text-gray-800 text-xl mb-2">
                    {formData.title || 'Your Blog Title Will Appear Here'}
                  </h4>

                  <div className="flex gap-2 mb-3 flex-wrap">
                    {formData.category && (
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                        {formData.category}
                      </span>
                    )}
                    {formData.subcategory && (
                      <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold">
                        {formData.subcategory}
                      </span>
                    )}
                    {formData.status && formData.status !== 'None' && (
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                        {formData.status}
                      </span>
                    )}
                  </div>

                  <p className="text-gray-700 text-sm leading-relaxed mb-4">
                    {formData.content || 'Your blog content preview will be displayed here as you type...'}
                  </p>

                  <hr className="my-2" />

                  <div className="flex items-center justify-between text-gray-400 text-sm mt-auto">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center">
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 21.364l-7.682-7.682a4.5 4.5 0 010-6.364z"
                          />
                        </svg>
                        0 likes
                      </span>
                      <span className="flex items-center">
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17 8h2a2 2 0 012 2v8a2 2 0 01-2 2H7a2 2 0 01-2-2v-8a2 2 0 012-2h2m4-4h-4a2 2 0 00-2 2v4a2 2 0 002 2h4a2 2 0 002-2v-4a2 2 0 00-2-2z"
                          />
                        </svg>
                        0 comments
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
