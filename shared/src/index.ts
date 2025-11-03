export type ClientId = string;

export interface Client {
  id: ClientId;
  name: string;
}

export interface Pet {
  id: string;
  clientId: ClientId;
  name: string;
}

export interface Appointment {
  id: string;
  clientId: ClientId;
  petId: string;
  when: string; // ISO
  notes?: string;
}