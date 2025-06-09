// frontend/src/App.js

import React, { useState, useRef, useEffect } from 'react';
import './App.css'; // Asegúrate de que este archivo CSS exista o elimínalo si no lo usas

function App() {
  const [isListening, setIsListening] = useState(false);
  const [liveTranscription, setLiveTranscription] = useState('');
  const [filteredProducts, setFilteredProducts] = useState(null);
  const rtcConnectionRef = useRef(null); // Referencia a la conexión WebRTC
  const transcriptionDisplayRef = useRef(null); // Referencia para el scroll automático de la transcripción

  // Función para obtener la clave efímera del backend
  const fetchEphemeralKey = async () => {
    try {
      console.log("Intentando obtener la clave efímera del backend...");
      const response = await fetch('http://localhost:8000/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error del backend al iniciar sesión: ${errorData.detail || response.statusText}`);
      }

      const data = await response.json();
      if (!data.ephemeral_key) {
        throw new Error("El backend no proporcionó 'ephemeral_key'. Revisa la respuesta del backend.");
      }
      console.log("Clave efímera obtenida con éxito.");
      return data.ephemeral_key;
    } catch (error) {
      console.error("Error al obtener la clave efímera:", error);
      alert(`Error al iniciar la sesión: ${error.message}. Asegúrate de que tu backend está corriendo en http://localhost:8000.`);
      return null;
    }
  };

  // Función principal para iniciar la escucha y la conexión WebRTC
  const startListening = async () => {
    if (isListening) return; // Evitar iniciar múltiples escuchas

    try {
      setIsListening(true);
      setLiveTranscription("Conectando...");
      setFilteredProducts(null); // Limpiar resultados anteriores

      console.log("1. Intentando obtener la clave efímera.");
      // 1. Obtener la clave efímera del backend
      const ephemeralKey = await fetchEphemeralKey();
      if (!ephemeralKey) {
        setIsListening(false);
        return;
      }
      console.log("2. Clave efímera obtenida. Creando RTCPeerConnection.");

      // 2. Crear una nueva conexión WebRTC Peer
      const rtc = new RTCPeerConnection();
      rtcConnectionRef.current = rtc; // Guardar referencia para cerrar más tarde

      // Añadir logs para los estados de la conexión WebRTC
      rtc.onicecandidate = (event) => {
          if (event.candidate) {
              // console.log("ICE Candidate:", event.candidate); // Descomentar para logs detallados de ICE
          } else {
              console.log("ICE Candidates Gathered (empty candidate).");
          }
      };
      rtc.oniceconnectionstatechange = () => {
          console.log("RTC iceConnectionState changed:", rtc.iceConnectionState);
          // Opcional: Manejar estados de conexión específicos
          if (rtc.iceConnectionState === 'disconnected' || rtc.iceConnectionState === 'failed' || rtc.iceConnectionState === 'closed') {
              console.warn("RTC ICE connection state indicates a problem or closure. State:", rtc.iceConnectionState);
              // Considera llamar a stopListening() aquí, pero ten cuidado con bucles infinitos si la causa es el propio stopListening.
              // En este caso, ya tenemos un try/catch en startListening que maneja errores.
          }
      };
      rtc.onconnectionstatechange = () => {
          console.log("RTC connectionState changed:", rtc.connectionState);
          if (rtc.connectionState === 'disconnected' || rtc.connectionState === 'failed' || rtc.connectionState === 'closed') {
              console.warn("RTC connection state indicates a problem or closure. State:", rtc.connectionState);
              // Podrías detener la escucha aquí si la conexión final falla por completo.
              // stopListening(); // ¡Precaución! Descomentar con cuidado para evitar bucles.
          }
      };
      rtc.onsignalingstatechange = () => {
          console.log("RTC signalingState changed:", rtc.signalingState);
      };


      console.log("3. Obtener acceso al micrófono.");
      // 3. Obtener acceso al micrófono del usuario
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => rtc.addTrack(track, stream)); // Añadir pista de audio a la conexión
      console.log("4. Micrófono accedido y pista de audio añadida a WebRTC.");

      console.log("5. Creando SDP Offer.");
      // 4. Crear una oferta SDP (Session Description Protocol)
      const offer = await rtc.createOffer();
      await rtc.setLocalDescription(offer); // Establecer la oferta como descripción local
      console.log("6. SDP Offer creada y establecida como descripción local. Signaling state:", rtc.signalingState);

      console.log("7. Enviando SDP Offer directamente a OpenAI.");
      // 5. Enviar la oferta SDP directamente a la API Realtime de OpenAI
      const signalingResponse = await fetch('https://api.openai.com/v1/realtime', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`, // Usar la clave efímera como Bearer token
          'Content-Type': 'application/sdp', // ¡Tipo de contenido específico para SDP!
          'OpenAI-Voice-Mode': 'api-v2', // Puede ser necesario para asegurar el comportamiento api-v2
        },
        body: offer.sdp, // El cuerpo de la solicitud es el SDP en texto plano
      });

      if (!signalingResponse.ok) {
        const errorDetail = await signalingResponse.text(); // La respuesta de error puede ser texto
        throw new Error(`Error de OpenAI al intercambiar SDP: ${signalingResponse.status} - ${errorDetail}`);
      }

      console.log("8. SDP Answer recibida de OpenAI.");
      // 6. Recibir la respuesta SDP (Answer) de OpenAI
      const answerSdp = await signalingResponse.text(); // La respuesta es el SDP de OpenAI como texto
      console.log("SDP Answer contenido (primeros 100 caracteres):", answerSdp.substring(0, 100)); // Loguea el inicio del SDP
      console.log("9. Intentando establecer SDP Answer como descripción remota. Current signaling state:", rtc.signalingState);

      // 7. Establecer la respuesta SDP de OpenAI como descripción remota
      // Esta es la línea donde el error 'signalingState is closed' suele ocurrir
      await rtc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));
      console.log("10. SDP Answer establecida como descripción remota. Conexión WebRTC establecida.");

      // 8. Configurar el Data Channel para recibir mensajes de texto (transcripciones, function_calls)
      rtc.ondatachannel = (event) => {
        const channel = event.channel;
        console.log("Data Channel establecido:", channel.label);

        channel.onmessage = (messageEvent) => {
          try {
            const message = JSON.parse(messageEvent.data);
            // console.log("Mensaje de Data Channel:", message); // Descomentar para ver todos los mensajes del canal de datos

            if (message.type === 'transcript') {
              // Actualizar la transcripción en tiempo real
              setLiveTranscription((prev) => {
                const lines = prev.split('\n');
                if (message.is_final) {
                  return prev + message.text + '\n'; // Si es final, añadir nueva línea
                }
                // Si no es final, actualizar la última línea o la única línea
                if (lines.length === 0 || message.text.startsWith(lines[lines.length - 1])) {
                    // Evitar duplicar si ya es parte del mensaje anterior o primer mensaje
                    return prev + message.text;
                }
                lines[lines.length - 1] = message.text;
                return lines.join('\n');
              });
            } else if (message.type === 'function_call') {
              // Manejar la llamada a función
              console.log("Function Call detectado:", message.name, message.args);
              if (message.name === 'filter_products') {
                setFilteredProducts(message.args); // Actualizar estado con los argumentos de la función
                alert(`Agente activado: Filtrando productos. Categoría: ${message.args.category || 'N/A'}, Color: ${message.args.color || 'N/A'}, Precio Máximo: ${message.args.max_price ? '$' + message.args.max_price : 'N/A'}.`);
              }
            } else if (message.type === 'error') {
              console.error("Error desde OpenAI Data Channel:", message.error);
              alert(`Error del agente: ${message.error}`);
              stopListening(); // Detener la escucha si hay un error crítico del agente
            }
          } catch (e) {
            console.error("Error al parsear mensaje de data channel:", e, messageEvent.data);
          }
        };

        channel.onopen = () => {
          console.log("Data Channel abierto. Enviando configuración inicial de sesión...");
          // Enviar una actualización de sesión para configurar el modelo de transcripción
          channel.send(JSON.stringify({
            type: 'session.update',
            session: {
              input_audio_transcription: { model: 'whisper-1' }, // Usar Whisper para la transcripción del audio del usuario
              // output_audio_speaker: { voice: 'alloy' }, // Descomentar si necesitas forzar la voz aquí
            },
          }));
        };
        channel.onclose = () => console.log("Data Channel cerrado.");
        channel.onerror = (e) => console.error("Error en Data Channel:", e);
      };

      // 9. Configurar la reproducción del audio de respuesta de la IA
      rtc.ontrack = (event) => {
        const [stream] = event.streams;
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length) {
          console.log('Recibiendo audio de respuesta de la IA.');
          const audio = new Audio();
          audio.srcObject = stream;
          audio.autoplay = true; // Reproducir el audio de la IA automáticamente
        }
      };

      console.log("Escucha iniciada. ¡Listo para hablar!");
      setLiveTranscription("Habla ahora...");

    } catch (error) {
      setIsListening(false);
      console.error("Error en startListening (catch block):", error);
      alert(`Error al iniciar la escucha: ${error.message}. Verifica la consola para más detalles.`);

      // Limpieza de la conexión WebRTC en caso de error
      if (rtcConnectionRef.current) {
        console.log("Cerrando rtcConnectionRef.current en el catch block. Signaling state:", rtcConnectionRef.current.signalingState);
        rtcConnectionRef.current.getSenders().forEach(sender => {
          if (sender.track) {
            sender.track.stop(); // Detener las pistas de audio del usuario
          }
        });
        rtcConnectionRef.current.close();
        rtcConnectionRef.current = null;
      }
    }
  };

  // Función para detener la escucha y cerrar la conexión
  const stopListening = () => {
    setIsListening(false);
    if (rtcConnectionRef.current) {
      console.log("Iniciando stopListening. Signaling state:", rtcConnectionRef.current.signalingState);
      rtcConnectionRef.current.getSenders().forEach(sender => sender.track?.stop()); // Detener todas las pistas de medios enviadas
      rtcConnectionRef.current.close(); // Cerrar la conexión WebRTC
      rtcConnectionRef.current = null;
      console.log("Conexión WebRTC cerrada explícitamente.");
    }
    setLiveTranscription("Grabación detenida.");
    console.log("Escucha detenida y conexión WebRTC cerrada.");
  };

  // Efecto para hacer scroll automático en el área de transcripción
  useEffect(() => {
    if (transcriptionDisplayRef.current) {
      transcriptionDisplayRef.current.scrollTop = transcriptionDisplayRef.current.scrollHeight;
    }
  }, [liveTranscription]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>🎧 VUEN AI - E-commerce Voice Agent</h1>
        <p>Asistente de compras activado por voz (OpenAI Realtime Voice - WebRTC)</p>
      </header>

      <main>
        <section className="controls">
          <button
            onClick={isListening ? stopListening : startListening}
            style={{
              padding: '12px 25px', fontSize: '1.1em', fontWeight: 'bold',
              color: 'white', backgroundColor: isListening ? '#dc3545' : '#28a745',
              border: 'none', borderRadius: '8px', cursor: 'pointer',
              boxShadow: '0 4px 6px rgba[0,0,0,0.1]',
              transition: 'background-color 0.3s ease, transform 0.2s ease',
            }}
            onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            {isListening ? '🔴 Detener Escucha' : '🎙️ Iniciar Escucha'}
          </button>
        </section>

        <section className="transcription-area" style={{ marginTop: '30px' }}>
          <h2>Transcripción en Tiempo Real</h2>
          <pre
            ref={transcriptionDisplayRef}
            style={{
              minHeight: '150px', maxHeight: '300px', border: '1px solid #444',
              padding: '15px', borderRadius: '8px', backgroundColor: '#1c1c1c',
              color: '#bbb', textAlign: 'left', overflowY: 'auto',
              whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontSize: '1em'
            }}
          >
            {liveTranscription || 'La transcripción aparecerá aquí. Intenta decir algo como "Muéstrame zapatillas rojas por menos de 100 dólares".'}
          </pre>
        </section>

        <section className="results-area" style={{
          marginTop: '40px', padding: '20px', border: '1px solid #007bff',
          borderRadius: '8px', backgroundColor: '#e6f7ff', textAlign: 'center',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#007bff', marginBottom: '20px' }}>Resultados del Agente E-commerce</h2>
          {filteredProducts ? (
            <div style={{ fontSize: '1.1em', lineHeight: '1.6', color: '#333' }}>
              <p>El agente ha detectado una intención de filtrado:</p>
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                <li style={{ marginBottom: '8px' }}><strong>Categoría:</strong> <span style={{ fontWeight: 'normal', color: '#0056b3' }}>{filteredProducts.category || 'No especificada'}</span></li>
                <li style={{ marginBottom: '8px' }}><strong>Color:</strong> <span style={{ fontWeight: 'normal', color: '#0056b3' }}>{filteredProducts.color || 'No especificado'}</span></li>
                <li style={{ marginBottom: '8px' }}><strong>Precio Máximo:</strong> <span style={{ fontWeight: 'normal', color: '#0056b3' }}>{filteredProducts.max_price ? `$${filteredProducts.max_price}` : 'N/A'}</span></li>
              </ul>
              <p style={{ marginTop: '15px', fontStyle: 'italic', color: '#666' }}>
                (Estos son los argumentos de la función `filter_products` llamada por la IA. Aquí integrarías tu lógica de búsqueda de productos real.)
              </p>
            </div>
          ) : (
            <p style={{ color: '#666', fontSize: '1.1em' }}>
              Los detalles de los productos filtrados por voz aparecerán aquí una vez que la IA identifique una función de filtrado.
            </p>
          )}
        </section>
      </main>

      <footer className="App-footer" style={{ marginTop: '50px', color: '#888', textAlign: 'center' }}>
        <p>&copy; 2025 VUEN AI E-commerce Agent</p>
      </footer>
    </div>
  );
}

export default App;