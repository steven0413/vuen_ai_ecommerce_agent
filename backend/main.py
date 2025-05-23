from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import openai

# Carga las variables de entorno desde .env
load_dotenv()

# Inicializa la aplicación FastAPI
app = FastAPI()

# Configura CORS (Cross-Origin Resource Sharing)
# Crucial para que el frontend (que estará en un origen diferente) pueda comunicarse con tu backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],  # Permite todos los métodos (GET, POST, etc.)
    allow_headers=["*"],  # Permite todos los encabezados
)

# Obtiene la clave API de OpenAI desde las variables de entorno
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    # Esta excepción detendrá la aplicación si no se encuentra la clave.
    raise ValueError("La variable de entorno OPENAI_API_KEY no está configurada. Por favor, revisa tu archivo .env")

# Inicializa el cliente de OpenAI
openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)


@app.get("/")
async def root():
    return {"message": "Bienvenido al Backend del Agente de E-commerce de VUEN AI"}

@app.post("/session")
async def create_realtime_session():
    """
    Endpoint para generar una clave efímera (token de sesión) para la API de Realtime de OpenAI.
    """
    try:
        # Llama a la API de OpenAI para crear una sesión en tiempo real.
        # La librería OpenAI gestiona el endpoint correcto (/v1/realtime/sessions).
        # La respuesta es un objeto de sesión que contiene el token necesario para WebRTC.
        session_object = await openai_client.realtime.sessions.create()

        # Accedemos al token de la sesión.
        # Según la documentación de OpenAI para la API de tiempo real,
        # el token para establecer la conexión WebRTC se encuentra en el atributo 'token'.
        ephemeral_key = session_object.token

        if not ephemeral_key:
            # Si el token no se encuentra, lanzamos un error.
            raise HTTPException(status_code=500, detail="La respuesta de OpenAI no contenía un token de sesión válido.")

        # Retorna la clave efímera al frontend.
        return {"ephemeral_key": ephemeral_key}

    except openai.APIError as e:
        # Manejo de errores específicos de la API de OpenAI.
        # Accedemos al mensaje de error de la API si está disponible, o usamos la representación del error.
        error_message = e.response.json().get("error", {}).get("message", str(e)) if hasattr(e, 'response') and hasattr(e.response, 'json') else str(e)
        status_code = e.status_code if hasattr(e, 'status_code') else 500
        raise HTTPException(status_code=status_code, detail=f"Error de la API de OpenAI: {error_message}")
    except Exception as e:
        # Manejo de cualquier otro error inesperado.
        raise HTTPException(status_code=500, detail=f"Error interno del servidor: {str(e)}")