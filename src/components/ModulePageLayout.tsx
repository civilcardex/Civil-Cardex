import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import MobileOnlyMessage from './MobileOnlyMessage';

interface ModulePageLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  mainClassName?: string;
}

export default function ModulePageLayout({ title: _title, description: _description, children, mainClassName = '' }: ModulePageLayoutProps) {
  return (
    <>
      <Navbar />
      <MobileOnlyMessage />
      <main id="main-content" className={`flex-grow pt-16 ${mainClassName}`} style={{ background: '#111317', minHeight: '100vh' }}>
        {children}
      </main>
      <Footer />
    </>
  );
}
