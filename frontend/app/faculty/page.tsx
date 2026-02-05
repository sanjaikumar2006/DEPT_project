'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/config';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { BookOpen, ChevronRight, Megaphone, Beaker, Bell, FilePlus, Users, Camera } from 'lucide-react';

export default function FacultyDashboard() {
    const [faculty, setFaculty] = useState<any>(null);
    const [theoryCourses, setTheoryCourses] = useState<any[]>([]);
    const [labCourses, setLabCourses] = useState<any[]>([]);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', section: 'All' });
    const [message, setMessage] = useState('');

    // State for profile picture URL
    const [profilePic, setProfilePic] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');
        const userId = localStorage.getItem('user_id');

        if (!token || (role !== 'Faculty' && role !== 'HOD')) {
            router.push('/login');
            return;
        }

        const fetchData = async () => {
            try {
                // 1. Fetch faculty profile
                const res = await axios.get(`${API_URL}/faculty/${userId}`);
                const facultyData = res.data;
                setFaculty(facultyData);

                // Set saved photo link from DB, otherwise fallback to UI-Avatars
                if (facultyData.profile_pic) {
                    setProfilePic(facultyData.profile_pic);
                } else {
                    setProfilePic(`https://ui-avatars.com/api/?name=${facultyData.name}&background=random`);
                }

                // 2. Fetch Assigned Courses
                const coursesRes = await axios.get(`${API_URL}/courses?faculty_id=${userId}`);
                const assignedCourses = coursesRes.data;

                setTheoryCourses(assignedCourses.filter((c: any) => !c.title.includes('(Lab)')));
                setLabCourses(assignedCourses.filter((c: any) => c.title.includes('(Lab)')));

                // 3. Fetch Announcements
                const annRes = await axios.get(`${API_URL}/announcements?type=Faculty`);
                const globalAnnRes = await axios.get(`${API_URL}/announcements?type=Global`);
                setAnnouncements([...annRes.data, ...globalAnnRes.data]);

            } catch (error) {
                console.error("Error loading dashboard data:", error);
            }
        };
        fetchData();
    }, [router]);

    // HANDLER: Sends photo to backend for permanent storage
    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const userId = localStorage.getItem('user_id');

            // Local preview for better UX
            setProfilePic(URL.createObjectURL(file));

            const formData = new FormData();
            formData.append('file', file);

            try {
                // Hits the faculty endpoint: /faculty/{staff_no}/photo
                const res = await axios.post(`${API_URL}/faculty/${userId}/photo`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                // Backend returns {"profile_pic": url}
                if (res.data && res.data.profile_pic) {
                    setProfilePic(res.data.profile_pic);
                    alert("Profile photo updated successfully!");
                }
            } catch (err) {
                console.error("Photo upload failed:", err);
                alert("Failed to save photo to server.");
                // Revert to fallback if failed
                if (faculty) setProfilePic(`https://ui-avatars.com/api/?name=${faculty.name}&background=random`);
            }
        }
    };

    const handlePostAnnouncement = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                title: newAnnouncement.title,
                content: newAnnouncement.content,
                type: "Student",
                posted_by: faculty.name,
                course_code: "Global",
                section: newAnnouncement.section
            };
            await axios.post(`${API_URL}/announcements`, payload);
            setMessage("Announcement posted to Section " + newAnnouncement.section);
            setNewAnnouncement({ title: '', content: '', section: 'All' });
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setMessage("Failed to post announcement.");
        }
    };

    if (!faculty) return <div className="min-h-screen flex items-center justify-center font-bold text-blue-900">Authenticating Staff Portal...</div>;

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <Navbar />
            <div className="container mx-auto px-4 py-8 flex-grow">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-blue-900">Faculty Dashboard</h1>
                    <span className="bg-blue-100 text-blue-800 px-4 py-1 rounded-full font-semibold uppercase text-xs">
                        {faculty.designation}
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-blue-900">
                            <div className="flex flex-col items-center mb-4">
                                <div className="relative group w-24 h-24 mb-4">
                                    <img
                                        src={profilePic || ""}
                                        alt="Profile"
                                        className="w-24 h-24 rounded-full object-cover border-4 border-gray-100 shadow-sm"
                                    />
                                    <label className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition cursor-pointer text-white">
                                        <Camera size={20} />
                                        <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                                    </label>
                                </div>
                                <h2 className="text-xl font-bold text-blue-900 text-center">{faculty.name}</h2>
                                <p className="text-xs text-gray-400 font-mono mt-1">{faculty.staff_no}</p>
                            </div>
                            <div className="space-y-3 text-sm border-t pt-4 font-medium">
                                <p className="flex justify-between"><span className="text-gray-500">Dept:</span> <span className="font-bold">Information Technology</span></p>
                                <p className="flex justify-between"><span className="text-gray-500">Joined:</span> <span className="font-bold">{faculty.doj}</span></p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Bell size={16} className="text-blue-600" /> Administrative Notices
                            </h3>
                            <div className="space-y-3">
                                {announcements.slice(0, 3).map((ann: any) => (
                                    <div key={ann.id} className="p-3 bg-blue-50 rounded border border-blue-100">
                                        <p className="text-xs font-bold text-blue-900">{ann.title}</p>
                                        <p className="text-[10px] text-gray-600 line-clamp-2">{ann.content}</p>
                                    </div>
                                ))}
                                {announcements.length === 0 && <p className="text-xs text-gray-400 italic">No recent notifications.</p>}
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2 space-y-8">
                        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-600">
                            <h2 className="text-xl font-bold mb-4 text-blue-900 flex items-center gap-2">
                                <BookOpen className="text-blue-600" /> My Theory Subjects
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {theoryCourses.length > 0 ? theoryCourses.map((course) => (
                                    <div key={course.id} className="border rounded-lg p-4 bg-gray-50 hover:border-blue-500 transition-all group">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-blue-900">{course.code}</h3>
                                            <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-2 py-0.5 rounded uppercase">Section {course.section}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-4 font-semibold h-8 line-clamp-2">{course.title}</p>
                                        <div className="grid grid-cols-1 gap-2">
                                            <button 
                                                onClick={() => router.push(`/faculty/manage/${course.code}/${course.section}`)} 
                                                className="bg-blue-900 text-white py-2 rounded text-[10px] font-bold hover:bg-orange-500 flex items-center justify-center gap-1 transition-colors uppercase tracking-widest"
                                            >
                                                <Users size={12} /> Manage Marks & Uploads
                                            </button>
                                        </div>
                                    </div>
                                )) : <p className="col-span-2 p-4 text-center text-sm text-gray-400 italic">No theory subjects assigned to your ID.</p>}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-600">
                            <h2 className="text-xl font-bold mb-4 text-purple-900 flex items-center gap-2">
                                <Beaker className="text-purple-600" /> My Lab Subjects
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {labCourses.length > 0 ? labCourses.map((lab) => (
                                    <div key={lab.id} className="border rounded-lg p-4 bg-purple-50/30 hover:border-purple-500 transition-all group">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-purple-900">{lab.code}</h3>
                                            <span className="bg-purple-100 text-purple-700 text-[9px] font-black px-2 py-0.5 rounded uppercase">Section {lab.section}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-4 font-semibold h-8 line-clamp-2">{lab.title.replace(' (Lab)', '')}</p>
                                        <div className="grid grid-cols-1 gap-2">
                                            {/* FIXED: Changed route to /labmanage for lab subjects */}
                                            <button 
                                                onClick={() => router.push(`/faculty/labmanage/${lab.code}/${lab.section}`)} 
                                                className="bg-purple-600 text-white py-2 rounded text-[10px] font-bold hover:bg-orange-500 flex items-center justify-center gap-1 transition-colors uppercase tracking-widest"
                                            >
                                                <Users size={12} /> Manage Lab
                                            </button>
                                        </div>
                                    </div>
                                )) : <p className="col-span-2 p-4 text-center text-sm text-gray-400 italic">No laboratory subjects assigned to your ID.</p>}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-orange-500">
                            <h2 className="text-xl font-bold mb-4 text-blue-900 flex items-center gap-2">
                                <Megaphone className="text-orange-500" /> Notify My Students
                            </h2>
                            {message && <p className="mb-4 p-2 bg-green-100 text-green-700 rounded text-xs text-center font-bold">{message}</p>}
                            <form onSubmit={handlePostAnnouncement} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <input className="p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none font-medium" placeholder="Headline..." value={newAnnouncement.title} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })} required />
                                    <select value={newAnnouncement.section} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, section: e.target.value })} className="p-2 border rounded bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs">
                                        <option value="All">Target: All Sections</option>
                                        <option value="A">Section A Only</option>
                                        <option value="B">Section B Only</option>
                                        <option value="C">Section C Only</option>
                                    </select>
                                </div>
                                <textarea className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none h-20 font-medium" placeholder="Announcement details..." value={newAnnouncement.content} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })} required />
                                <button type="submit" className="w-full bg-orange-500 text-white font-bold py-2 rounded hover:bg-orange-600 transition uppercase text-xs tracking-widest shadow-md">
                                    Broadcast to Students
                                </button>
                            </form>
                        </div>
                        <div
                            onClick={() => router.push("/faculty/Progress")}
                            className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-600 cursor-pointer hover:shadow-lg transition-all group"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-green-900 flex items-center gap-2">
                                        Update Your Progress
                                    </h2>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Record academic progress, performance, and remarks.
                                    </p>
                                </div>

                                <ChevronRight
                                    size={28}
                                    className="text-green-600 group-hover:translate-x-1 transition-transform"
                                />
                            </div>
                        </div>


                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}