import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'southside · deine side community',description:'von gündoğdu bis side: dolmuş-linien gemeinsam mappen, hotels ehrlich bewerten und bazaare entdecken.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="de"><body>{children}</body></html>}
