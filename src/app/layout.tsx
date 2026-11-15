import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Khmer Dub Studio · Independent dubbing workspace',description:'Transcribe, translate and voice your videos in Khmer. Local video editing with your choice of speech provider.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
