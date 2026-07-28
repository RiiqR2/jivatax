declare global {
  namespace Express {
    interface Request {
      user?: import("./interfaces/authenticated-user.interface").AuthenticatedUser;
      authenticatedEntity?: import("../users/entities/user.entity").UserEntity;
    }
  }
}
export {};
