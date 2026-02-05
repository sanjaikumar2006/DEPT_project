'use client';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/config';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { 
    FileText, BookOpen, Bell, CheckCircle, Download, 
    ArrowLeft, ClipboardList, PlayCircle, ExternalLink,
    RefreshCw // Added for refresh button
} from 'lucide-react'; 

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const courseId = decodeURIComponent(resolvedParams.id);

    const [activeTab, setActiveTab] = useState('notes');
    const [materials, setMaterials] = useState<any[]>([]);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [studentProfile, setStudentProfile] = useState<any>(null);
    const [marks, setMarks] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [debugInfo, setDebugInfo] = useState<any>(null); // For debugging

    useEffect(() => {
        const userId = localStorage.getItem('user_id');
        
        const fetchCourseContent = async () => {
            try {
                const stuRes = await axios.get(`${API_URL}/student/${userId}`);
                const profile = stuRes.data;
                setStudentProfile(profile);

                // FIX 1: Try multiple endpoints to find materials
                console.log(`Fetching materials for course: ${courseId}`);
                
                // Try the main endpoint
                const matRes = await axios.get(`${API_URL}/materials/${courseId}`);
                console.log('Materials response:', matRes.data);
                
                // Also try the new endpoint if needed
                if (matRes.data.length === 0) {
                    const altRes = await axios.get(`${API_URL}/materials/course/${courseId}`);
                    console.log('Alternative endpoint response:', altRes.data);
                    setMaterials(altRes.data.filter((m: any) => m.type !== 'Lab Manual'));
                } else {
                    setMaterials(matRes.data.filter((m: any) => m.type !== 'Lab Manual'));
                }

                // FIX 2: Fetch debug info to see what's in the database
                try {
                    const debugRes = await axios.get(`${API_URL}/debug/materials`);
                    setDebugInfo(debugRes.data);
                    console.log('Debug materials:', debugRes.data);
                } catch (debugError) {
                    console.log('Debug endpoint not available');
                }

                const annRes = await axios.get(`${API_URL}/announcements?student_id=${userId}`);
                const specificNotices = annRes.data.filter((a: any) => 
                    a.course_code === courseId || (a.course_code === "Global" && a.type === "Student")
                );
                setAnnouncements(specificNotices);

                const marksRes = await axios.get(`${API_URL}/marks/cia?student_id=${userId}`);
                const specificMark = marksRes.data.find((m: any) => m.subject === courseId);
                setMarks(specificMark);

            } catch (error) {
                console.error("Connection failed:", error);
            } finally {
                setLoading(false);
            }
        };

        if (courseId && userId) fetchCourseContent();
    }, [courseId]);

    // Function to refresh materials
    const refreshMaterials = async () => {
        const userId = localStorage.getItem('user_id');
        try {
            console.log('Refreshing materials...');
            const matRes = await axios.get(`${API_URL}/materials/${courseId}`);
            console.log('Refreshed materials:', matRes.data);
            setMaterials(matRes.data.filter((m: any) => m.type !== 'Lab Manual'));
            alert('Materials refreshed!');
        } catch (error) {
            console.error('Refresh failed:', error);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-blue-900">Loading Course Resources...</div>;

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <Navbar />
            
            <div className="bg-blue-900 text-white py-10 shadow-lg border-b-4 border-orange-500">
                <div className="container mx-auto px-4">
                    <div className="flex justify-between items-center mb-3">
                        <button onClick={() => router.push('/student')} className="flex items-center gap-2 text-sm hover:text-orange-400 opacity-80 transition font-bold uppercase tracking-widest">
                            <ArrowLeft size={16} /> Back to Dashboard
                        </button>
                        <button 
                            onClick={refreshMaterials}
                            className="flex items-center gap-2 text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition font-bold uppercase tracking-widest"
                        >
                            <RefreshCw size={14} /> Refresh
                        </button>
                    </div>
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-4xl font-black tracking-tight uppercase">{courseId}</h1>
                            <p className="opacity-80 font-medium tracking-wide uppercase text-xs mt-1">Theory Subject Portal</p>
                        </div>
                        <div className="text-right">
                            <span className="bg-orange-500 text-white px-3 py-1 rounded text-[10px] font-black uppercase tracking-tighter">
                                Section {studentProfile?.section || 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8 flex-grow">
                {/* DEBUG INFO (Hidden by default, can be enabled) */}
                {debugInfo && process.env.NODE_ENV === 'development' && (
                    <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded text-xs">
                        <details>
                            <summary className="font-bold cursor-pointer">Debug Info (Click to expand)</summary>
                            <div className="mt-2">
                                <p>Total materials in DB: {debugInfo.total_materials}</p>
                                <p>Course ID being searched: {courseId}</p>
                                <p>Materials found for this course: {materials.length}</p>
                                <div className="mt-2">
                                    <strong>All materials in DB:</strong>
                                    <ul className="list-disc pl-4 mt-1">
                                        {debugInfo.materials.map((m: any, i: number) => (
                                            <li key={i}>
                                                ID: {m.id}, Course: {m.course_code}, Type: {m.type}, Title: {m.title}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </details>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-xl overflow-hidden min-h-[550px] border border-gray-100">
                    
                    {/* TABS SECTION */}
                    <div className="flex overflow-x-auto border-b bg-gray-50/50 sticky top-0 z-10 no-scrollbar">
                        {[
                            { id: 'notes', label: 'Notes', icon: FileText },
                            { id: 'qb', label: 'Question Bank', icon: BookOpen },
                            { id: 'videos', label: 'Videos', icon: PlayCircle },
                            { id: 'assignments', label: 'Assignments', icon: ClipboardList },
                            { id: 'announcements', label: 'Announcements', icon: Bell },
                            { id: 'attendance', label: 'Attendance', icon: CheckCircle },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center px-8 py-5 font-bold transition whitespace-nowrap border-b-4 uppercase text-[10px] tracking-widest ${
                                    activeTab === tab.id 
                                    ? 'bg-white text-blue-900 border-b-blue-900 border-t-4 border-t-orange-500 shadow-sm' 
                                    : 'text-gray-400 hover:text-blue-900 hover:bg-white/80'
                                }`}
                            >
                                <tab.icon size={18} className="mr-2" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="p-8">
                        {/* LECTURE NOTES TAB */}
                        {activeTab === 'notes' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 uppercase tracking-tighter">
                                        <FileText className="text-blue-900" /> Unit Wise Notes
                                    </h2>
                                    <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold">
                                        {materials.filter(m => m.type === 'Lecture Notes').length} files
                                    </span>
                                </div>
                                {materials.filter(m => m.type === 'Lecture Notes').length > 0 ? (
                                    materials.filter(m => m.type === 'Lecture Notes').map((note, i) => (
                                        <div key={i} className="flex items-center justify-between p-5 border-b hover:bg-blue-50/50 transition group rounded-lg mb-3">
                                            <div className="flex items-center">
                                                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg mr-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                    <FileText size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-800">{note.title}</p>
                                                    <p className="text-xs text-gray-500 mt-1">Uploaded by: {note.posted_by}</p>
                                                </div>
                                            </div>
                                            <a 
                                                href={note.file_link} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="flex items-center gap-2 text-blue-900 text-[10px] font-black border-2 border-blue-900 px-4 py-2 rounded-lg hover:bg-blue-900 hover:text-white transition uppercase tracking-widest"
                                            >
                                                <Download size={14} /> View PDF
                                            </a>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-20">
                                        <FileText className="mx-auto text-gray-300 mb-4" size={48} />
                                        <p className="text-gray-400 italic">No lecture notes uploaded yet.</p>
                                        <p className="text-xs text-gray-500 mt-2">Check back later or contact your faculty.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* QUESTION BANK TAB */}
                        {activeTab === 'qb' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 uppercase tracking-tighter">
                                        <BookOpen className="text-teal-600" /> Exam Question Bank
                                    </h2>
                                    <span className="text-xs bg-teal-100 text-teal-800 px-3 py-1 rounded-full font-bold">
                                        {materials.filter(m => m.type === 'Question Bank').length} files
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {materials.filter(m => m.type === 'Question Bank').length > 0 ? (
                                        materials.filter(m => m.type === 'Question Bank').map((q, i) => (
                                            <div key={i} className="p-5 border rounded-xl hover:shadow-lg flex justify-between items-center bg-gray-50 border-gray-100 transition-all group">
                                                <div>
                                                    <span className="font-bold text-gray-800 text-sm uppercase tracking-tighter">{q.title}</span>
                                                    <p className="text-xs text-gray-500 mt-1">Uploaded by: {q.posted_by}</p>
                                                </div>
                                                <a 
                                                    href={q.file_link} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="text-white bg-teal-600 px-4 py-2 rounded-lg text-[10px] font-bold hover:bg-teal-700 shadow-md transition uppercase tracking-widest"
                                                >
                                                    Download QB
                                                </a>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="col-span-2 text-center py-20">
                                            <BookOpen className="mx-auto text-gray-300 mb-4" size={48} />
                                            <p className="text-gray-400 italic">Question bank files are not yet available.</p>
                                            <p className="text-xs text-gray-500 mt-2">Your faculty will upload them before exams.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* YOUTUBE VIDEOS TAB */}
                        {activeTab === 'videos' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 uppercase tracking-tighter">
                                        <PlayCircle className="text-pink-600" /> Video Tutorials
                                    </h2>
                                    <span className="text-xs bg-pink-100 text-pink-800 px-3 py-1 rounded-full font-bold">
                                        {materials.filter(m => m.type === 'YouTube Video').length} videos
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {materials.filter(m => m.type === 'YouTube Video').length > 0 ? (
                                        materials.filter(m => m.type === 'YouTube Video').map((video, i) => (
                                            <div key={i} className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
                                                <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative">
                                                    <PlayCircle size={48} className="text-pink-500 opacity-80 group-hover:scale-110 transition-transform" />
                                                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[9px] px-2 py-0.5 rounded font-bold uppercase">YouTube</div>
                                                </div>
                                                <div className="p-4">
                                                    <h3 className="font-bold text-gray-800 mb-2 line-clamp-2 uppercase tracking-tighter text-sm">{video.title}</h3>
                                                    <p className="text-xs text-gray-500 mb-4">Shared by: {video.posted_by}</p>
                                                    <a 
                                                        href={video.file_link} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="flex items-center justify-center gap-2 w-full bg-pink-600 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-pink-700 transition"
                                                    >
                                                        <ExternalLink size={14} /> Watch Video
                                                    </a>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="col-span-full text-center py-20">
                                            <PlayCircle className="mx-auto text-gray-300 mb-4" size={48} />
                                            <p className="text-gray-400 italic">No video tutorials shared for this subject.</p>
                                            <p className="text-xs text-gray-500 mt-2">Your faculty will share relevant YouTube links here.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ASSIGNMENTS TAB */}
                        {activeTab === 'assignments' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 uppercase tracking-tighter">
                                        <ClipboardList className="text-orange-500" /> Pending Assignments
                                    </h2>
                                    <span className="text-xs bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-bold">
                                        {materials.filter(m => m.type === 'Assignment').length} assignments
                                    </span>
                                </div>
                                {materials.filter(m => m.type === 'Assignment').length > 0 ? (
                                    materials.filter(m => m.type === 'Assignment').map((assn, i) => (
                                        <div key={i} className="flex items-center justify-between p-5 border-l-8 border-orange-500 bg-white shadow-sm rounded-r-lg mb-4 hover:shadow-md transition border border-gray-100">
                                            <div>
                                                <p className="font-bold text-gray-800 text-lg uppercase tracking-tighter">{assn.title}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">Course: {courseId}</p>
                                                <p className="text-xs text-gray-500 mt-1">Assigned by: {assn.posted_by}</p>
                                            </div>
                                            <a 
                                                href={assn.file_link} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="bg-orange-500 text-white px-5 py-2 rounded-lg text-[10px] font-bold hover:bg-orange-600 uppercase tracking-widest transition shadow-sm"
                                            >
                                                Download Assignment
                                            </a>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-20">
                                        <ClipboardList className="mx-auto text-gray-300 mb-4" size={48} />
                                        <p className="text-gray-400 italic">No assignments posted yet.</p>
                                        <p className="text-xs text-gray-500 mt-2">Your faculty will upload assignments here when available.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ANNOUNCEMENT TAB */}
                        {activeTab === 'announcements' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 uppercase tracking-tighter">
                                        <Bell className="text-yellow-500" /> Subject Notifications
                                    </h2>
                                    <span className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-bold">
                                        {announcements.length} announcements
                                    </span>
                                </div>
                                {announcements.length > 0 ? (
                                    announcements.map((ann, i) => (
                                        <div key={i} className="bg-yellow-50/50 border-l-8 border-yellow-500 p-6 rounded-r-xl mb-4 relative overflow-hidden shadow-sm border border-yellow-100">
                                            <div className="flex justify-between items-start">
                                                <p className="font-bold text-blue-900 text-lg uppercase tracking-tighter">{ann.title}</p>
                                                <span className="text-[9px] bg-yellow-200 text-yellow-800 px-2 py-1 rounded font-bold uppercase">
                                                    {ann.course_code === "Global" ? "General" : "Subject"}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-700 mt-2 font-medium leading-relaxed">{ann.content}</p>
                                            <div className="flex justify-between items-center mt-4">
                                                <p className="text-[9px] text-yellow-600 font-bold uppercase">Posted by: {ann.posted_by}</p>
                                                <p className="text-[9px] text-gray-500">{new Date(ann.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-20">
                                        <Bell className="mx-auto text-gray-300 mb-4" size={48} />
                                        <p className="text-gray-400 italic">No recent announcements for this subject.</p>
                                        <p className="text-xs text-gray-500 mt-2">Check here for important updates from your faculty.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ATTENDANCE TAB */}
                        {activeTab === 'attendance' && (
                            <div className="text-center py-12 animate-in zoom-in duration-300">
                                <h2 className="text-xl font-black mb-10 text-gray-800 uppercase tracking-widest">
                                    Course Attendance Summary
                                </h2>
                                <div className="relative inline-flex items-center justify-center mb-8">
                                    <svg className="w-48 h-48 transform -rotate-90">
                                        <circle cx="96" cy="96" r="80" stroke="#f3f4f6" strokeWidth="12" fill="transparent" />
                                        <circle 
                                            cx="96" cy="96" r="80" stroke={(marks?.subject_attendance || 0) < 75 ? '#ef4444' : '#1e3a8a'} 
                                            strokeWidth="12" fill="transparent" 
                                            strokeDasharray={502} 
                                            strokeDashoffset={502 - ((marks?.subject_attendance || 0) / 100) * 502} 
                                            strokeLinecap="round"
                                            className="transition-all duration-1000"
                                        />
                                    </svg>
                                    <div className="absolute flex flex-col items-center">
                                        <span className="text-5xl font-black text-blue-900">{(marks?.subject_attendance || 0)}%</span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Present</span>
                                    </div>
                                </div>
                                <p className="text-gray-500 font-medium italic text-sm">*Attendance for {courseId} is managed by the assigned faculty.</p>
                                
                                {(marks?.subject_attendance || 0) < 75 && (
                                    <div className="mt-8 p-4 bg-red-50 border-2 border-red-100 rounded-xl text-red-600 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm inline-block">
                                        ⚠️ Shortage of Attendance Warning ⚠️
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}