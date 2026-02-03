import React from 'react';

export const Footer = () => {
    return (
        <footer className="w-full py-8 mt-12 border-t border-gray-200 dark:border-gray-800">
            <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                <div className="mb-4 md:mb-0">
                    <p>&copy; {new Date().getFullYear()} FirstLine AI. All rights reserved.</p>
                </div>
                <div className="flex gap-6">
                    <a href="#" className="hover:text-black dark:hover:text-white transition-colors">Privacy Policy</a>
                    <a href="#" className="hover:text-black dark:hover:text-white transition-colors">Terms of Service</a>
                    <a href="#" className="hover:text-black dark:hover:text-white transition-colors">Contact</a>
                </div>
            </div>
        </footer>
    );
};
