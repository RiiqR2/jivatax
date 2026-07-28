import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { isValidChileanRut } from '../utils/chilean-rut';

export function IsChileanRut(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => registerDecorator({
    name: 'isChileanRut', target: target.constructor, propertyName: String(propertyKey), options,
    validator: { validate: (value: unknown) => typeof value === 'string' && isValidChileanRut(value), defaultMessage: (_args: ValidationArguments) => 'El RUT no es válido.' },
  });
}
