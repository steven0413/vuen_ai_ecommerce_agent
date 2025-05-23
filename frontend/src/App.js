import React, { useState, useEffect } from 'react';
import './App.css'; 

function App() {
  // Estado para la transcripción en tiempo real
  const [liveTranscription, setLiveTranscription] = useState("");

  // Estado para el mensaje de productos filtrados simulado
  const [filteredProductsMessage, setFilteredProductsMessage] = useState("");

  // Función para simular la llamada a filter_products
  const simulateFilterProducts = (category, color = "any", maxPrice = "no limit") => {
    let message = `Mostrando productos: Categoría '${category}'`;
    if (color !== "any") {
      message += `, Color '${color}'`;
    }
    if (maxPrice !== "no limit") {
      message += `, Precio máximo '$${maxPrice}'`;
    }
    message += ". (Datos simulados)";
    setFilteredProductsMessage(message);
  };

  // Función para simular una transcripción en vivo (puedes adaptarla o eliminarla si no la usas)
  const simulateLiveTranscript = (text) => {
    setLiveTranscription(prev => prev + " " + text);
  };

  const handleStartRecording = async () => {
    // lógica actual para iniciar la conexión WebRTC y llamar al backend
    setLiveTranscription("Simulando inicio de grabación...");
    console.log("Intentando iniciar grabación...");

    // Simular una interacción aquí.
    setTimeout(() => {
        // simulateLiveTranscript("Show me red sneakers under 100 dollars.");
        // setTimeout(() => {
            // simulateFilterProducts("zapatillas", "rojas", 100);
        // }, 2000); // Retraso para simular el procesamiento
    }, 1000);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>VUEN AI E-commerce Agent</h1>
        <p>Real-time voice-powered product filtering</p>
      </header>

      <main>
        <section className="controls">
          <button
            onClick={handleStartRecording}
            style={{
              padding: '10px 20px',
              fontSize: '1.2em',
              fontWeight: 'bold',
              color: 'white',
              backgroundColor: '#28a745', 
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background-color 0.3s ease',
              marginRight: '10px'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#218838'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#28a745'}
          >
            Iniciar Grabación (Funcionalidad Realtime Inactiva)
          </button>
          {
            //  Aregar más botones aquí si es necesario
          }
        </section>

        <section className="transcription-area" style={{ marginTop: '30px' }}>
          <h2>Transcripción en Tiempo Real</h2>
          <div style={{
            minHeight: '100px',
            border: '1px solid #444',
            padding: '15px',
            borderRadius: '8px',
            backgroundColor: '#1c1c1c',
            color: '#bbb',
            textAlign: 'left',
            overflowY: 'auto'
          }}>
            {liveTranscription ? liveTranscription : "Esperando voz..."}
          </div>
        </section>

        {/* Resultados del Agente de E-commerce (Simulado) */}
        <section className="mock-results" style={{
            marginTop: '40px',
            padding: '20px',
            border: '1px solid #444',
            borderRadius: '8px',
            backgroundColor: '#2a2a2a',
            textAlign: 'center'
          }}>
          <h2 style={{ color: '#eee', marginBottom: '20px' }}>Resultados del Agente de E-commerce (Simulado)</h2>
          {filteredProductsMessage ? (
            <p style={{ color: '#00cc66', fontSize: '1.2em', fontWeight: 'bold' }}>
              {filteredProductsMessage}
            </p>
          ) : (
            <p style={{ color: '#aaa', fontSize: '1.1em' }}>
              Aquí se mostrarán los resultados de filtrar productos por voz, o puedes usar los botones de simulación.
            </p>
          )}

          <div style={{ marginTop: '20px' }}>
            <button
                onClick={() => simulateFilterProducts("zapatillas", "rojas", 100)}
                style={{
                    padding: '10px 20px',
                    fontSize: '1em',
                    fontWeight: 'bold',
                    color: 'white',
                    backgroundColor: '#007bff',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    transition: 'background-color 0.3s ease',
                    marginRight: '10px'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#0056b3'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#007bff'}
            >
                Simular: "Show me red sneakers under $100"
            </button>
            <button
                onClick={() => simulateFilterProducts("camisetas", "azules")}
                style={{
                    padding: '10px 20px',
                    fontSize: '1em',
                    fontWeight: 'bold',
                    color: 'white',
                    backgroundColor: '#007bff',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    transition: 'background-color 0.3s ease',
                    marginRight: '10px'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#0056b3'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#007bff'}
            >
                Simular: "Show me blue shirts"
            </button>
            <button
                onClick={() => setFilteredProductsMessage("")} // Para resetear la simulación
                style={{
                    padding: '10px 20px',
                    fontSize: '1em',
                    fontWeight: 'bold',
                    color: 'white',
                    backgroundColor: '#6c757d', // Gris para resetear
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    transition: 'background-color 0.3s ease'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#5a6268'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#6c757d'}
            >
                Resetear Simulación
            </button>
          </div>
        </section>
      </main>

      <footer className="App-footer" style={{ marginTop: '50px', color: '#888' }}>
        <p>&copy; 2025 VUEN AI E-commerce Agent</p>
      </footer>
    </div>
  );
}

export default App;