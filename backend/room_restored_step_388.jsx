Created At: 2026-06-18T15:36:38Z
Completed At: 2026-06-18T15:36:38Z
File Path: `file:///c:/Users/KrishnavamsiGurajala/.gemini/antigravity/scratch/watch-together/frontend/src/Room.jsx`
Total Lines: 7062
Total Bytes: 374456
Showing lines 2950 to 3000
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
2950:                       } catch(e) {}
2951:                     })();
2952:                   } else { decrypted = plain; }
2953:                 }
2954:               }
2955:               return { ...msg, decryptedText: decrypted, mediaUrl: decryptedMediaUrl };
2956:             } catch(e) {}
2957:           }
2958:           return msg;
2959:         });
2960:       }
2961:       return changed ? next : prev;
2962:     });
2963:   }, [keyPair, cryptoReady, username]);
2964: 
2965:   // Sync volume state explicitly to WebRTC native video element
2966:   useEffect(() => {
2967:     if (localVideoRef.current) {
2968:       localVideoRef.current.volume = playerVolume;
2969:       localVideoRef.current.muted = playerMuted;
2970:     }
2971:   }, [playerVolume, playerMuted, mediaUrl, isLocalStream]);
2972: 
2973:   useEffect(() => {
2974:     if (localVideoRef.current && localVideoRef.current.textTracks.length > 0) {
2975:       localVideoRef.current.textTracks[0].mode = 'hidden';
2976:     }
2977:   }, [subtitlesVisible, subtitlesUrl]);
2978: 
2979:   useEffect(() => {
2980:     if (!subtitleVttText) { subtitleCuesRef.current = []; return; }
2981:     subtitleCuesRef.current = parseVttCues(subtitleVttText);
2982:   }, [subtitleVttText]);
2983: 
2984:   useEffect(() => {
2985:     if (!subtitleCuesRef.current.length || !subtitlesVisible) { setActiveCue(null); return; }
2986:     const adjTime = currentTime + subtitleSettings.delay;
2987:     const speed = subtitleSettings.speed || 1;
2988:     const found = subtitleCuesRef.current.find(c => {
2989:       const adjEnd = c.start + (c.end - c.start) / speed;
2990:       return adjTime >= c.start && adjTime <= adjEnd;
2991:     }) || null;
2992:     setActiveCue(found);
2993:   }, [currentTime, subtitlesVisible, subtitleSettings.delay, subtitleSettings.speed]);
2994: 
2995:   useEffect(() => {
2996:     try {
2997:       const key = `subtitleSettings_${username || 'guest'}`;
2998:       localStorage.setItem(key, JSON.stringify(subtitleSettings));
2999:     } catch {}
3000:   }, [subtitleSettings, username]);
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
