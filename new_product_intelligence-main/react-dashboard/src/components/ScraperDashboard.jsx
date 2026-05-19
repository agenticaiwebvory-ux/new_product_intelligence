import React, { useState, useEffect } from 'react';
import {
  Upload,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Download,
  FileText,
  Trash2,
  Play,
  Clock,
  ExternalLink,
  ChevronRight,
  Eye,
  TrendingUp,
  Palette,
  Maximize
} from 'lucide-react';
import axios from 'axios';

const SCRAPER_API_BASE = import.meta.env.VITE_SCRAPER_API || "/scraper-api";

const ScraperDashboard = () => {
  const [vendorName, setVendorName] = useState('');
  const [forceScrape, setForceScrape] = useState(false);
  const [file, setFile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Poll for job updates
  useEffect(() => {
    const interval = setInterval(() => {
      const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'queued');
      if (activeJobs.length > 0) {
        refreshJobs();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [jobs]);

  const refreshJobs = async () => {
    const updatedJobs = await Promise.all(jobs.map(async (job) => {
      if (job.status === 'running' || job.status === 'queued') {
        try {
          const res = await axios.get(`${SCRAPER_API_BASE}/jobs/${job.job_id}`);
          return res.data;
        } catch (err) {
          console.error("Failed to poll job:", job.job_id, err);
          return { ...job, status: 'failed', error: 'Connection lost' };
        }
      }
      return job;
    }));
    setJobs(updatedJobs);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const startScrape = async () => {
    if (!file || !vendorName) {
      alert("Please select a file and enter a vendor name.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('vendor_name', vendorName);
    formData.append('force', forceScrape);

    try {
      const res = await axios.post(`${SCRAPER_API_BASE}/scrape`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const newJob = {
        job_id: res.data.job_id,
        status: 'queued',
        vendor_name: vendorName,
        file: file.name,
        progress: { percent: 0, step: 'queued', detail: 'Connecting...' }
      };

      setJobs([newJob, ...jobs]);
      setFile(null);
      setVendorName('');
    } catch (err) {
      console.error("Scrape request failed:", err);
      alert("Failed to start scrape: " + (err.response?.data?.error || err.message));
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-emerald-500';
      case 'failed': return 'text-red-500';
      case 'running': return 'text-blue-500';
      default: return 'text-slate-400';
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'completed': return 'bg-emerald-50';
      case 'failed': return 'bg-red-50';
      case 'running': return 'bg-blue-50';
      default: return 'bg-slate-50';
    }
  };

  return (
    <div className="p-2 mt-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <header className="py-3 h-[60px] flex items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-[1.2rem] font-black tracking-wider text-slate-900 m-0 uppercase">PRODUCT SCRAPER</h1>
          <span className="text-[0.7rem] font-extrabold text-brand tracking-widest bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase">V4 ENGINE</span>
        </div>
        <div className="ml-auto flex gap-2">
          <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border border-slate-200 text-[0.75rem] font-bold">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse"></div>
            SCRAPER BACKEND ONLINE (8002)
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-8">
        {/* Left Column: Control Panel */}
        <div className="flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-[24px] p-8 shadow-sm">
            <h2 className="text-[1rem] font-black text-slate-800 mb-6 flex items-center gap-2.5 uppercase tracking-tight">
              <Upload size={20} className="text-brand" /> START NEW SEARCH
            </h2>

            <div className="flex flex-col gap-5">
              {/* File Upload Area */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-[16px] p-8 text-center transition-all cursor-pointer relative ${dragActive ? 'border-brand bg-indigo-50' : 'border-slate-200 bg-slate-50'
                  }`}
              >
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.csv,.xlsx"
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <FileText size={24} className={file ? 'text-emerald-500' : 'text-slate-400'} />
                </div>
                {file ? (
                  <div>
                    <div className="text-[0.9rem] font-black text-slate-900 truncate px-2">{file.name}</div>
                    <div className="text-[0.75rem] text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-[0.9rem] font-black text-slate-900">Drop vendor PDF or CSV</div>
                    <div className="text-[0.75rem] text-slate-500 mt-1">Click to browse files</div>
                  </div>
                )}
              </div>

              {/* Vendor Selection */}
              <div>
                <label className="text-[0.7rem] font-black text-slate-500 uppercase tracking-widest mb-2 block">Vendor Name</label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. Betsy & Adam"
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[0.9rem] font-bold outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all placeholder:text-slate-300"
                />
              </div>

              {/* Force Toggle */}
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-[16px] border border-slate-200">
                <div>
                  <div className="text-[0.85rem] font-black text-slate-900">Force Re-scrape</div>
                  <div className="text-[0.7rem] text-slate-500 mt-0.5">Ignore cache and re-search all</div>
                </div>
                <button
                  onClick={() => setForceScrape(!forceScrape)}
                  className={`w-11 h-6 rounded-full relative cursor-pointer transition-all border-none ${forceScrape ? 'bg-brand' : 'bg-slate-300'
                    }`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white absolute top-0.75 transition-all shadow-sm ${forceScrape ? 'left-[22px]' : 'left-0.75'
                    }`} />
                </button>
              </div>

              {/* Start Button */}
              <button
                onClick={startScrape}
                disabled={isUploading || !file || !vendorName}
                className={`w-full h-[52px] rounded-xl text-[1rem] font-black flex items-center justify-center gap-3 transition-all border-none shadow-md ${isUploading || !file || !vendorName
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-br from-brand to-indigo-600 text-white cursor-pointer hover:shadow-lg active:scale-95'
                  }`}
              >
                {isUploading ? <RefreshCw size={20} className="animate-spin" /> : <Play size={20} />}
                {isUploading ? 'UPLOADING...' : 'START SCRAPER'}
              </button>
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-[24px] p-6 flex items-center gap-4">
            <div className="bg-brand text-white p-2.5 rounded-xl"><Clock size={22} /></div>
            <div>
              <div className="text-[0.65rem] font-black text-brand uppercase tracking-widest">System Status</div>
              <div className="text-[0.85rem] font-black text-slate-900">Waiting for next batch...</div>
            </div>
          </div>
        </div>

        {/* Right Column: Job List */}
        <div className="bg-white border border-slate-200 rounded-[24px] p-8 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-[1rem] font-black text-slate-800 m-0 flex items-center gap-2.5 uppercase tracking-tight">
              <RefreshCw size={20} className="text-brand" /> ACTIVITY FEED
            </h2>
            <button
              onClick={refreshJobs}
              className="bg-transparent border-none text-slate-400 text-[0.8rem] font-bold cursor-pointer flex items-center gap-1.5 hover:text-brand transition-colors"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {jobs.length === 0 ? (
              <div className="text-center py-16 text-slate-300">
                <Search size={48} className="mx-auto mb-4 opacity-20" />
                <div className="text-[0.9rem] font-bold">No search activity yet</div>
                <div className="text-[0.75rem] mt-1">Upload a file to start tracking results</div>
              </div>
            ) : (
              jobs.map((job) => (
                <div key={job.job_id} className="border border-slate-100 rounded-[20px] p-5 hover:border-slate-200 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex gap-4">
                      <div className="bg-slate-50 w-10 h-10 rounded-lg flex items-center justify-center border border-slate-100">
                        <FileText size={20} className="text-slate-400" />
                      </div>
                      <div>
                        <div className="text-[0.9rem] font-black text-slate-900">{job.vendor_name}</div>
                        <div className="text-[0.7rem] text-slate-400 font-bold tracking-wide">{job.file} • ID: {job.job_id.slice(0, 8)}</div>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[0.7rem] font-black uppercase tracking-wider ${getStatusBg(job.status)} ${getStatusColor(job.status)}`}>
                      {job.status}
                    </div>
                  </div>

                  {job.status === 'running' || job.status === 'queued' ? (
                    <div className="mt-2">
                      <div className="flex justify-between text-[0.75rem] font-black mb-2">
                        <span className="text-slate-900">{job.progress?.step}</span>
                        <span className="text-blue-600">{job.progress?.percent}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-brand transition-all duration-500"
                          style={{ width: `${job.progress?.percent}%` }}
                        />
                      </div>
                      <div className="text-[0.7rem] text-slate-400 mt-2 italic font-medium">
                        {job.progress?.detail}
                      </div>
                    </div>
                  ) : null}

                  {job.status === 'completed' && (
                    <div className="flex items-center justify-between bg-emerald-50 px-4 py-3 rounded-xl mt-2 border border-emerald-100">
                      <div className="flex items-center gap-2 text-[0.75rem] font-black text-emerald-700">
                        <CheckCircle2 size={16} /> Data enrichment complete
                      </div>
                      <a
                        href={`${SCRAPER_API_BASE}/jobs/${job.job_id}/download`}
                        className="bg-emerald-500 text-white no-underline px-3 py-1.5 rounded-lg text-[0.75rem] font-black flex items-center gap-2 shadow-sm hover:bg-emerald-600 transition-all active:scale-95"
                      >
                        <Download size={14} /> DOWNLOAD EXCEL
                      </a>
                    </div>
                  )}

                  {job.status === 'failed' && (
                    <div className="bg-red-50 p-3 rounded-xl mt-2 flex items-center gap-2.5 text-red-700 text-[0.75rem] font-black border border-red-100">
                      <AlertCircle size={16} /> Error: {job.error}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScraperDashboard;
