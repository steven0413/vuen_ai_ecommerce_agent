import os
import openai
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# --- AÑADIMOS ESTO PARA DEPURACIÓN EXTREMA ---
print("--- DEBUG: main.py cargado correctamente ---")

# Esto mostrará la ruta de la librería openai que se está cargando
if hasattr(openai, '__file__'):
    print(f"DEBUG: Ruta de openai cargado: {openai.__file__}")
else:
    print("DEBUG: No se pudo determinar la ruta de openai.")

# Forzar una importación para asegurarnos de que el módulo no es un placeholder
try:
    from openai import OpenAI as ActualOpenAIClient
    print("DEBUG: Importación explícita de OpenAI exitosa.")
except Exception as e:
    print(f"DEBUG: Fallo la importación explícita de OpenAI: {e}")
    ActualOpenAIClient = None # Asegurarse de que no haya un error si falla

# --- FIN DEPURACIÓN EXTREMA ---

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    raise ValueError("La variable de entorno OPENAI_API_KEY no está configurada.")

# Cambiamos aquí para usar ActualOpenAIClient si la importación fue exitosa
if ActualOpenAIClient:
    openai_client = ActualOpenAIClient(api_key=OPENAI_API_KEY)
else:
    # Si la importación explícita falla, revertimos al método original, pero el error ya debería haber sido reportado
    print("DEBUG: Usando openai.OpenAI normal porque la importación explícita falló.")
    openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)


# --- INICIO DEL CÓDIGO DE DEPURACIÓN DE ATRIBUTOS ---
print(f"DEBUG: Tipo de openai_client: {type(openai_client)}")
if hasattr(openai_client, 'realtime'):
    print("DEBUG: openai_client SÍ TIENE el atributo 'realtime'.")
    if hasattr(openai_client.realtime, 'sessions'):
        print("DEBUG: openai_client.realtime SÍ TIENE el atributo 'sessions'.")
    else:
        print("DEBUG: openai_client.realtime NO TIENE el atributo 'sessions'.")
else:
    print("DEBUG: openai_client NO TIENE el atributo 'realtime'.")
# --- FIN DEL CÓDIGO DE DEPURACIÓN DE ATRIBUTOS ---


@app.get("/")
async def root():
    return {"message": "Bienvenido al Backend del Agente de E-commerce de VUEN AI"}

@app.post("/session")
async def create_realtime_session():
    try:
        session_object = await openai_client.realtime.sessions.create()
        ephemeral_key = session_object.token
        if not ephemeral_key:
            raise HTTPException(status_code=500, detail="No se pudo obtener la clave efímera.")

        return {"ephemeral_key": ephemeral_key}

    except openai.APIError as e: # Esta es la clase base para la mayoría de los errores en la versión 1.x
        print(f"Error de la API de OpenAI: {e}")
        status_code = e.status_code if hasattr(e, 'status_code') else 500
        detail_message = f"Error de la API de OpenAI: {e.response.text if hasattr(e, 'response') and hasattr(e.response, 'text') else str(e)}"
        raise HTTPException(status_code=status_code, detail=detail_message)
    except Exception as e:
        print(f"Error inesperado al crear la sesión en tiempo real: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno del servidor: {e}")