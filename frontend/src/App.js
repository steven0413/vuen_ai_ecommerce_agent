// frontend/src/App.js
import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// URL de tu backend FastAPI
const BACKEND_URL = 'http://127.0.0.1:8000'; // Asegúrate de que coincida con donde corre tu FastAPI

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [productResult, setProductResult] = useState(null); // Para almacenar el resultado del producto
  const [errorMessage, setErrorMessage] = useState('');

  // Refs para WebRTC y MediaRecorder
  const mediaRecorderRef = useRef(null);
  const wsRef = useRef(null); // WebSocket para la conexión con OpenAI Realtime API
  const audioContextRef = useRef(null);
  const audioInputRef = useRef(null);
  const wsConnectedRef = useRef(false); // Para controlar el estado de la conexión WebSocket

  // Función para obtener la clave efímera del backend
  const fetchEphemeralKey = async () => {
    try {
      setErrorMessage('');
      const response = await fetch(`${BACKEND_URL}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error del backend al obtener la clave: ${errorData.detail || response.statusText}`);
      }

      const data = await response.json();
      return data.ephemeral_key;
    } catch (error) {
      console.error('Error al obtener la clave efímera:', error);
      setErrorMessage(`Error: ${error.message}. Asegúrate de que tu backend FastAPI esté funcionando y con la API Key de OpenAI correcta.`);
      return null;
    }
  };

  // Función para iniciar la grabación y la conexión WebRTC
  const startRecording = async () => {
    setTranscript('');
    setProductResult(null);
    setErrorMessage('');

    const ephemeralKey = await fetchEphemeralKey();
    if (!ephemeralKey) {
      return; // No podemos continuar sin la clave
    }

    try {
      // 1. Solicitar acceso al micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' }); // O 'audio/ogg;codecs=opus'

      // 2. Establecer la conexión WebSocket con OpenAI Realtime API
      // Utiliza la URL de la API de tiempo real de OpenAI, que incluye el token
      wsRef.current = new WebSocket(`wss://api.openai.com/v1/realtime?token=${ephemeralKey}`);

      wsRef.current.onopen = (event) => {
        console.log('WebSocket connection established:', event);
        wsConnectedRef.current = true;
        setIsRecording(true);

        // Configurar el AudioContext y el MediaStreamSource
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        audioInputRef.current = audioContextRef.current.createMediaStreamSource(stream);

        // Crear un procesador de script para obtener datos de audio
        // Este nodo bufferiza y procesa el audio del micrófono
        const scriptProcessor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
        audioInputRef.current.connect(scriptProcessor);
        scriptProcessor.connect(audioContextRef.current.destination);

        scriptProcessor.onaudioprocess = (audioEvent) => {
          if (wsConnectedRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const inputBuffer = audioEvent.inputBuffer.getChannelData(0);
            // Convertir Float32Array a Int16Array para enviar a OpenAI
            const int16Buffer = new Int16Array(inputBuffer.length);
            for (let i = 0; i < inputBuffer.length; i++) {
              int16Buffer[i] = Math.max(-1, Math.min(1, inputBuffer[i])) * 0x7FFF; // Escalar a Int16
            }
            wsRef.current.send(int16Buffer);
          }
        };

        // Enviar un mensaje de configuración inicial si es necesario (según la API de OpenAI)
        // La documentación de OpenAI para la API de tiempo real sugiere que se puede enviar un mensaje
        // con información sobre el modelo y las herramientas.
        // Esto es crucial para la llamada a funciones.
        const configMessage = {
          messages: [{ role: 'user', content: '¿Qué producto buscas?' }], // Mensaje inicial de contexto
          model: 'gpt-4o-2024-05-13', // O el modelo 'gpt-4o-realtime-preview' si está disponible
          // tools: [...] // Aquí definirías las herramientas para la llamada a funciones
          // Para esta prueba, vamos a definir una herramienta simple para "buscar_producto"
          tools: [
            {
              type: "function",
              function: {
                name: "search_product",
                description: "Busca un producto en el catálogo de la tienda de e-commerce.",
                parameters: {
                  type: "object",
                  properties: {
                    query: {
                      type: "string",
                      description: "El nombre o descripción del producto a buscar.",
                    },
                    category: {
                      type: "string",
                      description: "La categoría del producto (opcional, ej. 'electrónica', 'ropa').",
                    },
                  },
                  required: ["query"],
                },
              },
            },
            // Puedes añadir más herramientas aquí si necesitas otras funciones
          ],
        };
        wsRef.current.send(JSON.stringify(configMessage));


      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);

        // Manejo de la transcripción
        if (data.type === 'transcript') {
          // Si es una transcripción final, la concatenamos.
          // Si es parcial, la mostramos temporalmente.
          if (data.is_final) {
            setTranscript((prev) => prev + data.text + ' ');
          } else {
            // Puedes usar un estado separado para la transcripción parcial
            // para que no se "acumule" si no es final.
            // setPartialTranscript(data.text);
            setTranscript(data.text); // Para simplificar, actualizamos el principal temporalmente
          }
        }
        
        // Manejo de la llamada a la función (tool_calls)
        if (data.type === 'tool_calls' && data.tool_calls && data.tool_calls.length > 0) {
          const toolCall = data.tool_calls[0]; // Asumimos una única llamada por simplicidad
          if (toolCall.type === 'function' && toolCall.function.name === 'search_product') {
            const args = JSON.parse(toolCall.function.arguments);
            console.log('Function call arguments:', args);
            // Simular la llamada a una API de productos
            const simulatedProduct = simulateProductSearch(args.query, args.category);
            setProductResult(simulatedProduct);

            // Importante: Debes enviar el resultado de la tool_call de vuelta a OpenAI
            // para que el modelo pueda generar una respuesta basada en esos resultados.
            // Esto es parte del ciclo de tool_use.
            const toolOutputMessage = {
              type: "tool_outputs",
              tool_outputs: [
                {
                  tool_call_id: toolCall.id,
                  output: JSON.stringify(simulatedProduct), // Enviar el resultado de la búsqueda
                },
              ],
            };
            wsRef.current.send(JSON.stringify(toolOutputMessage));
          }
        }

        // Manejo de las respuestas del asistente (modelo)
        if (data.type === 'assistant_response' && data.text) {
          // Después de una tool_call, el asistente puede generar una respuesta.
          setTranscript((prev) => prev + data.text + ' '); // Concatena la respuesta del asistente
        }


      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setErrorMessage('Error en la conexión WebSocket con OpenAI.');
        stopRecording();
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket connection closed:', event);
        wsConnectedRef.current = false;
        setIsRecording(false);
        // Limpiar recursos de audio
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        stream.getTracks().forEach(track => track.stop());
      };

    } catch (error) {
      console.error('Error al iniciar la grabación o WebRTC:', error);
      setErrorMessage(`Error de micrófono o WebRTC: ${error.message}. Asegúrate de permitir el acceso al micrófono.`);
      setIsRecording(false);
    }
  };

  // Función para detener la grabación
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    wsConnectedRef.current = false;
    setIsRecording(false);
  };

  // Función simulada para buscar productos (simula una API externa)
  const simulateProductSearch = (query, category) => {
    console.log(`Simulando búsqueda de producto: "${query}" en categoría "${category || 'cualquiera'}"`);
    // Aquí iría tu lógica real para buscar en una base de datos/API de productos
    if (query.toLowerCase().includes('auriculares')) {
      return { name: 'Auriculares Inalámbricos X500', price: '$99.99', description: 'Sonido de alta fidelidad con cancelación de ruido.', category: 'electrónica' };
    } else if (query.toLowerCase().includes('camisa')) {
      return { name: 'Camisa de Lino Veraniega', price: '$35.00', description: 'Ideal para climas cálidos, 100% lino.', category: 'ropa' };
    } else if (query.toLowerCase().includes('teclado')) {
      return { name: 'Teclado Mecánico RGB Pro', price: '$120.00', description: 'Switches rojos, retroiluminación personalizable.', category: 'electrónica' };
    }
    return { name: 'Producto no encontrado', description: `Lo siento, no pude encontrar un producto para "${query}".` };
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>VUEN AI E-commerce Agent</h1>
        <p>Ready to build the voice-powered experience!</p>

        {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}

        <button onClick={isRecording ? stopRecording : startRecording}>
          {isRecording ? 'Detener Grabación' : 'Iniciar Grabación'}
        </button>

        <div className="transcript-container">
          <h2>Transcripción en Tiempo Real:</h2>
          <p>{transcript || 'Pulsa "Iniciar Grabación" y habla...'}</p>
        </div>

        {productResult && (
          <div className="product-results">
            <h2>Resultado de Búsqueda de Producto:</h2>
            {productResult.name !== 'Producto no encontrado' ? (
              <>
                <p><strong>Nombre:</strong> {productResult.name}</p>
                <p><strong>Precio:</strong> {productResult.price}</p>
                <p><strong>Descripción:</strong> {productResult.description}</p>
                {productResult.category && <p><strong>Categoría:</strong> {productResult.category}</p>}
              </>
            ) : (
              <p>{productResult.description}</p>
            )}
          </div>
        )}
      </header>
    </div>
  );
}

export default App;