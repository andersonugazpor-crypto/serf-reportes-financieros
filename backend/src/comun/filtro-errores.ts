import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ErrorConflicto, ErrorDominio, ErrorNoEncontrado, ErrorValidacion } from './errores';

/** Traduce errores de dominio a respuestas HTTP con un formato uniforme. */
@Catch()
export class FiltroErrores implements ExceptionFilter {
  private readonly logger = new Logger('SERF');

  catch(error: unknown, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();
    let estado = HttpStatus.INTERNAL_SERVER_ERROR;
    let mensaje = 'Error interno del servidor.';

    if (error instanceof HttpException) {
      estado = error.getStatus();
      const cuerpo = error.getResponse() as string | { message?: string | string[] };
      const m = typeof cuerpo === 'string' ? cuerpo : cuerpo.message;
      mensaje = Array.isArray(m) ? m.join(' ') : (m ?? error.message);
    } else if (error instanceof ErrorDominio) {
      mensaje = error.message;
      estado =
        error instanceof ErrorNoEncontrado
          ? HttpStatus.NOT_FOUND
          : error instanceof ErrorConflicto
            ? HttpStatus.CONFLICT
            : error instanceof ErrorValidacion
              ? HttpStatus.BAD_REQUEST
              : HttpStatus.UNPROCESSABLE_ENTITY;
    } else {
      this.logger.error(error);
    }

    respuesta.status(estado).json({ estado, mensaje });
  }
}
