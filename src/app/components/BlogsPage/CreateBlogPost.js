'use client';

import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthContext } from '../../context/AuthContext';
import {
  Upload,
  User,
  Save,
  Eye,
  Image as ImageIcon,
  X,
  Plus,
  Hash,
  Calendar,
  Camera,
  Edit
} from 'lucide-react';

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
  const { user } = useContext(AuthContext) || {};

  const populateFormData = useCallback((blog) => {
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
  }, []);

  const fetchBlogData = useCallback(
    async (id) => {
      try {
        setIsLoading(true);
        const token =
          localStorage.getItem('adminToken') ||
          localStorage.getItem('blogToken');
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
        if (response.status === 401) {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('blogToken');
          router.push('/AdminLogin');
          return;
        }
        if (!response.ok) {
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
    },
    [populateFormData, router]
  );

  useEffect(() => {
    if (isModal && Object.keys(initialData).length > 0) {
      setIsEditMode(true);
      setBlogId(initialData._id);
      populateFormData(initialData);
    } else if (!isModal) {
      const id = searchParams.get('id');
      const mode = searchParams.get('mode');
      if (id && mode === 'edit') {
        setIsEditMode(true);
        setBlogId(id);
        fetchBlogData(id);
      }
    }
  }, [initialData, isModal, populateFormData, searchParams, fetchBlogData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (formData.title || formData.content) {
        setIsAutoSaving(true);
        setTimeout(() => setIsAutoSaving(false), 1000);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [formData.title, formData.content]);

  useEffect(() => {
    if (!isEditMode && formData.title) {
      setFormData((prev) => ({
        ...prev,
        urlSlug: slugify(prev.title)
      }));
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
    if (['dragenter', 'dragover'].includes(e.type)) setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) {
      handleImageUpload(file);
    } else {
      setError('Only image files are allowed.');
    }
  };

  const handleImageUpload = (file) => {
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
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
  };

  const removeImage = () => {
    setPreviewImage(null);
    setExistingImageUrl(null);
    setFormData((prev) => ({ ...prev, blogImage: null }));
  };

  const showNotification = (message, type = 'success') => {
    if (isModal) return;
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 ${
      type === 'success' ? 'bg-green-500' : 'bg-red-500'
    } text-white px-6 py-3 rounded-lg shadow-lg z-50`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, type === 'success' ? 3000 : 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (isModal && onSave) {
        await onSave({ ...formData, _id: blogId });
      } else {
        const token =
          localStorage.getItem('adminToken') ||
          localStorage.getItem('blogToken');
        if (!token) return router.push('/AdminLogin');
        if (!user) {
          setError('User not authenticated. Please log in again.');
          return;
        }
        const form = new FormData();
        form.append('title', formData.title);
        form.append('content', formData.content);
        form.append('category', formData.category);
        form.append('subcategory', formData.subcategory);
        form.append('author', formData.authorName || user.username || 'Admin');
        form.append('status', formData.status);
        if (formData.urlSlug) form.append('slug', formData.urlSlug);
        if (formData.blogImage) form.append('image', formData.blogImage);

        const url = isEditMode
          ? `${API_BASE}/api/blogs/${blogId}`
          : `${API_BASE}/api/blogs`;
        const method = isEditMode ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method,
          headers: { Authorization: `Bearer ${token}` },
          body: form
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 409) {
            throw new Error(
              errorData.message ||
                'Slug already exists. Please adjust the title or slug.'
            );
          }
          if (response.status === 401) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('blogToken');
            return router.push('/AdminLogin');
          }
          throw new Error(
            errorData.message ||
              `Failed to ${isEditMode ? 'update' : 'create'} blog post`
          );
        }

        const responseData = await response.json();
        showNotification(
          `Blog post ${isEditMode ? 'updated' : 'created'} successfully!`,
          'success'
        );
        if (!isEditMode) {
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
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred');
      showNotification(err.message || 'An error occurred', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    else if (!isModal) router.back();
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
      <div className={isModal ? 'w-full' : 'mx-auto max-w-screen-2xl p-6'}>
        <div className={isModal ? '' : 'lg:grid lg:grid-cols-12 gap-6'}>
          <div className={isModal ? '' : 'lg:col-span-7'}>
            <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-gray-100 p-6">
              <form
                id="blog-form"
                onSubmit={handleSubmit}
                className="space-y-6 pb-28 sm:pb-0"
              >
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg relative">
                    <span>{error}</span>
                    <button
                      type="button"
                      onClick={() => setError('')}
                      className="absolute top-2 right-2 text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Title */}
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
                    className={`${fieldBase} px-4 py-3`}
                    required
                    disabled={isSubmitting}
                    maxLength={200}
                    aria-describedby="title-help"
                  />
                  <p id="title-help" className={helpText}>
                    Aim for a concise headline under ~70 characters.
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
                    placeholder={
                      isEditMode
                        ? 'Edit slug if needed'
                        : 'Auto-generated from title'
                    }
                    className={`${fieldBase} px-4 py-3 ${
                      !isEditMode ? 'bg-gray-50' : ''
                    }`}
                    readOnly={!isEditMode}
                    maxLength={100}
                    aria-describedby="slug-help"
                  />
                  <p id="slug-help" className={helpText}>
                    Use lowercase-with-hyphens; descriptive & short.
                  </p>
                </div>

                {/* Content */}
                <div className="group">
                  <label className={labelBase}>Content</label>
                  <div className="rounded-xl border border-gray-200 bg-white/80 ring-1 ring-gray-200 focus-within:ring-2 focus-within:ring-blue-600 transition-shadow">
                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex gap-2">
                      <button
                        type="button"
                        className="px-2 py-1 font-bold"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 italic"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 underline"
                      >
                        U
                      </button>
                    </div>
                    <textarea
                      name="content"
                      value={formData.content}
                      onChange={handleInputChange}
                      placeholder="Type your blog content here..."
                      className="w-full px-4 py-3 border-0 focus:ring-0 resize-y min-h-[160px]"
                      rows={6}
                      required
                      disabled={isSubmitting}
                      maxLength={10000}
                      aria-describedby="content-help"
                    />
                  </div>
                  <p id="content-help" className={helpText}>
                    Use headings and short paragraphs for readability.
                  </p>
                </div>

                {/* Category & Subcategory */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelBase}>Category</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className={`${fieldBase} px-4 py-3`}
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
                      className={`${fieldBase} px-4 py-3`}
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
                      Matches backend enum exactly.
                    </p>
                  </div>
                </div>

                {/* Author & Status */}
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
                      className={`${fieldBase} px-4 py-3`}
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
                      className={`${fieldBase} px-4 py-3`}
                      disabled={isSubmitting}
                      aria-describedby="status-help"
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <p id="status-help" className={helpText}>
                      Highlight tag; not publication state.
                    </p>
                  </div>
                </div>

                {/* Image Upload */}
                <div className="mb-2">
                  <label className={`${labelBase} inline-flex items-center`}>
                    <Camera className="w-4 h-4 mr-2 text-blue-600" />
                    Blog Image
                  </label>
                  <div
                    className={`relative w-full min-h-[220px] p-4 flex items-center justify-center bg-white shadow-sm border-2 border-dashed ${
                      dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    } focus-within:ring-2 focus-within:ring-blue-600 transition-all`}
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
                          <img
                            src={previewImage}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5"
                          disabled={isSubmitting}
                          aria-label="Remove image"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        {isEditMode && existingImageUrl && !formData.blogImage && (
                          <p className="text-xs text-blue-600 mt-2">
                            Current image (upload new to replace)
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-center">
                        <Upload className="w-12 h-12 text-gray-400 mb-3" />
                        <p className="text-gray-700 mb-2">
                          {isEditMode
                            ? 'Upload new image or keep existing'
                            : 'Drag & drop an image, or'}
                        </p>
                        <label className="cursor-pointer inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg">
                          Browse
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileInput}
                            className="hidden"
                            disabled={isSubmitting}
                          />
                        </label>
                        <p className="text-xs text-gray-500 mt-2">
                          PNG, JPG, GIF up to 5MB
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="hidden sm:flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl"
                  >
                    {isSubmitting ? (
                      <>{isEditMode ? 'Updating...' : 'Publishing...'}</>
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
                      className="px-6 py-3 border rounded-xl bg-white text-gray-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              {/* Mobile Actions */}
              <div className="sm:hidden fixed inset-x-0 bottom-0 bg-white p-3 border-t border-gray-200">
                <div className="flex gap-2">
                  {(isModal || onCancel) && (
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-3 border rounded-xl text-gray-700"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    form="blog-form"
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl"
                  >
                    {isSubmitting ? 'Saving...' : isEditMode ? 'Update' : 'Publish'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {!isModal && (
            <aside className="lg:col-span-5">
              <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border p-6 sticky top-6">
                <div className="flex items-center mb-6">
                  <Eye className="w-5 h-5 mr-2 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Preview</h3>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl min-h-[300px] flex flex-col">
                  <div className="w-full rounded-lg overflow-hidden mb-4 bg-gray-100">
                    <div className="aspect-video w-full flex items-center justify-center">
                      {previewImage ? (
                        <img
                          src={previewImage}
                          alt="Blog preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-20 h-20 text-gray-300" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center text-sm text-gray-600 mb-4 gap-2">
                    <User className="w-5 h-5" />
                    <span>{formData.authorName || user?.username || 'Author Name'}</span>
                    <Calendar className="w-5 h-5" />
                    <span>{new Date().toLocaleDateString()}</span>
                  </div>
                  <h4 className="font-bold text-xl mb-2">
                    {formData.title || 'Your Blog Title Will Appear Here'}
                  </h4>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {formData.category && (
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs">
                        {formData.category}
                      </span>
                    )}
                    {formData.subcategory && (
                      <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs">
                        {formData.subcategory}
                      </span>
                    )}
                    {formData.status !== 'None' && (
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs">
                        {formData.status}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed mb-4">
                    {formData.content || 'Your blog content preview will appear here.'}
                  </p>
                  <hr className="my-2" />
                  <div className="flex items-center justify-between text-gray-400 text-sm mt-auto">
                    <div className="flex gap-4">
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
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
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
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
