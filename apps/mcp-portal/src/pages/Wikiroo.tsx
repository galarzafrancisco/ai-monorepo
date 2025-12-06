import { useState, useEffect } from "react";
import { WikirooService } from "../lib/api";
import type { PageResponseDto, PageSummaryDto, CreatePageDto, UpdatePageDto } from "shared";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

export default function WikirooPage() {
  const [pages, setPages] = useState<PageSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<PageResponseDto | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await WikirooService.wikirooControllerListPages();
      setPages(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pages");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: CreatePageDto = {
      title: formData.get("title") as string,
      content: formData.get("content") as string,
      author: formData.get("author") as string,
    };

    setCreating(true);
    setError(null);
    try {
      const newPage = await WikirooService.wikirooControllerCreatePage(data);
      await loadPages();
      setShowCreateForm(false);
      setSelectedPage(newPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create page");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdatePage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPage) return;

    const formData = new FormData(e.currentTarget);
    const data: UpdatePageDto = {
      title: formData.get("title") as string,
      content: formData.get("content") as string,
    };

    setUpdating(true);
    setError(null);
    try {
      const updated = await WikirooService.wikirooControllerUpdatePage(selectedPage.id, data);
      await loadPages();
      setSelectedPage(updated);
      setShowEditForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update page");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (!confirm("Are you sure you want to delete this page?")) return;

    try {
      await WikirooService.wikirooControllerDeletePage(pageId);
      await loadPages();
      setSelectedPage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete page");
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-white/60">Loading pages...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">Wikiroo</h1>
          <p className="text-white/60">Knowledge base and documentation</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-gradient-to-r from-sky-600 to-teal-500 hover:from-sky-500 hover:to-teal-400 rounded-lg"
        >
          + Create Page
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {selectedPage ? (
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => {
                setSelectedPage(null);
                setShowEditForm(false);
              }}
              className="text-sky-400 hover:text-sky-300"
            >
              ← Back to all pages
            </button>
            {!showEditForm && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowEditForm(true)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeletePage(selectedPage.id)}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg"
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          {showEditForm ? (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-8">
              <h2 className="text-2xl font-bold mb-6">Edit Page</h2>
              <form onSubmit={handleUpdatePage} className="space-y-4">
                <div>
                  <label htmlFor="edit-title" className="block text-sm font-semibold text-white/70 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    id="edit-title"
                    name="title"
                    required
                    defaultValue={selectedPage.title}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    disabled={updating}
                  />
                </div>

                <div>
                  <label htmlFor="edit-content" className="block text-sm font-semibold text-white/70 mb-2">
                    Content (Markdown)
                  </label>
                  <textarea
                    id="edit-content"
                    name="content"
                    rows={20}
                    required
                    defaultValue={selectedPage.content}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-sm"
                    disabled={updating}
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditForm(false)}
                    className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
                    disabled={updating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-sky-600 to-teal-500 hover:from-sky-500 hover:to-teal-400 rounded-lg disabled:opacity-50"
                    disabled={updating}
                  >
                    {updating ? "Updating..." : "Update Page"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-8">
              <h1 className="text-4xl font-bold mb-4">{selectedPage.title}</h1>
              <div className="text-sm text-white/60 mb-6">
                By {selectedPage.author} • {new Date(selectedPage.createdAt).toLocaleString()}
              </div>
              {selectedPage.tags && selectedPage.tags.length > 0 && (
                <div className="mb-6 flex flex-wrap gap-2">
                  {selectedPage.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-lg"
                      style={{
                        backgroundColor: tag.color ? `${tag.color}20` : "#ffffff20",
                        color: tag.color || "#ffffff",
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                  {selectedPage.content}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      ) : pages.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/60 mb-4">No pages created yet</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
          >
            Create your first page
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pages.map((page) => (
            <div
              key={page.id}
              onClick={async () => {
                try {
                  const fullPage = await WikirooService.wikirooControllerGetPage(page.id);
                  setSelectedPage(fullPage);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to load page");
                }
              }}
              className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 cursor-pointer transition-colors"
            >
              <h3 className="text-xl font-semibold mb-2">{page.title}</h3>
              <div className="text-sm text-white/60 mb-3">
                By {page.author}
              </div>
              {page.tags && page.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {page.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 text-xs rounded"
                      style={{
                        backgroundColor: tag.color ? `${tag.color}20` : "#ffffff20",
                        color: tag.color || "#ffffff",
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b1220] border border-white/10 rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-3xl font-bold">Create New Page</h2>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-white/60 hover:text-white"
                disabled={creating}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePage} className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-semibold text-white/70 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  required
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Page title"
                  disabled={creating}
                />
              </div>

              <div>
                <label htmlFor="author" className="block text-sm font-semibold text-white/70 mb-2">
                  Author
                </label>
                <input
                  type="text"
                  id="author"
                  name="author"
                  required
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Your name"
                  disabled={creating}
                />
              </div>

              <div>
                <label htmlFor="content" className="block text-sm font-semibold text-white/70 mb-2">
                  Content (Markdown)
                </label>
                <textarea
                  id="content"
                  name="content"
                  rows={15}
                  required
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-sm"
                  placeholder="# Your page content here..."
                  disabled={creating}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-sky-600 to-teal-500 hover:from-sky-500 hover:to-teal-400 rounded-lg disabled:opacity-50"
                  disabled={creating}
                >
                  {creating ? "Creating..." : "Create Page"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
