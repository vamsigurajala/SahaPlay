Created At: 2026-06-18T15:36:52Z
Completed At: 2026-06-18T15:36:52Z
File Path: `file:///c:/Users/KrishnavamsiGurajala/.gemini/antigravity/scratch/watch-together/frontend/src/Room.jsx`
Total Lines: 7062
Total Bytes: 374456
Showing lines 660 to 680
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
660:       case 'instagram': return FaInstagram;
661:       case 'soundcloud': return FaSoundcloud;
662:       default: return Monitor;
663:     }
664:   };
665: 
666:   function isEmbedPlatform(url) {
667:     if (!url) return false;
668:     return /youtube\.com|youtu\.be|twitch\.tv|vimeo\.com|soundcloud\.com/i.test(url);
669:   }
670: 
671:   function isNSFWUrl(_url) {
672:     return false; // No content restrictions
673:   }
674: 
675:   const handleFullscreen = () => {
676:     if (!document.fullscreenElement) {
677:       if (playerWrapRef.current?.requestFullscreen) {
678:         playerWrapRef.current.requestFullscreen().catch(err => {
679:           console.error(`Error attempting to enable full-screen mode: ${err.message}`);
680:         });
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
