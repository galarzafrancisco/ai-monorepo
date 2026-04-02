import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiProperty, getSchemaPath } from '@nestjs/swagger';

// Base class for allOf (inheritance)
export class BaseEntityDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  createdAt: string;

  @ApiProperty({ type: String })
  updatedAt: string;
}

// Extended class using allOf pattern
export class ExtendedEntityDto extends BaseEntityDto {
  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  description: string;
}

// Further extended class
export class FullyExtendedEntityDto extends ExtendedEntityDto {
  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty({ type: String, required: false })
  category?: string;
}

// Discriminated union with oneOf (polymorphism)
export enum PaymentMethodType {
  CARD = 'card',
  BANK_ACCOUNT = 'bank_account',
  PAYPAL = 'paypal',
}

export class CardPaymentDto {
  @ApiProperty({ enum: PaymentMethodType, default: PaymentMethodType.CARD })
  type: PaymentMethodType.CARD;

  @ApiProperty({ type: String })
  cardNumber: string;

  @ApiProperty({ type: String })
  expiryDate: string;

  @ApiProperty({ type: String })
  cvv: string;
}

export class BankAccountPaymentDto {
  @ApiProperty({ enum: PaymentMethodType, default: PaymentMethodType.BANK_ACCOUNT })
  type: PaymentMethodType.BANK_ACCOUNT;

  @ApiProperty({ type: String })
  accountNumber: string;

  @ApiProperty({ type: String })
  routingNumber: string;

  @ApiProperty({ type: String })
  bankName: string;
}

export class PayPalPaymentDto {
  @ApiProperty({ enum: PaymentMethodType, default: PaymentMethodType.PAYPAL })
  type: PaymentMethodType.PAYPAL;

  @ApiProperty({ type: String })
  email: string;

  @ApiProperty({ type: String })
  paypalId: string;
}

// Union type for payment method
export type PaymentMethodDto = CardPaymentDto | BankAccountPaymentDto | PayPalPaymentDto;

// Event discriminated union
export enum EventType {
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  PROJECT_CREATED = 'project_created',
  PROJECT_ARCHIVED = 'project_archived',
}

export class UserCreatedEventDto {
  @ApiProperty({ enum: EventType, default: EventType.USER_CREATED })
  type: EventType.USER_CREATED;

  @ApiProperty({ type: String })
  userId: string;

  @ApiProperty({ type: String })
  userName: string;

  @ApiProperty({ type: String })
  email: string;
}

export class UserUpdatedEventDto {
  @ApiProperty({ enum: EventType, default: EventType.USER_UPDATED })
  type: EventType.USER_UPDATED;

  @ApiProperty({ type: String })
  userId: string;

  @ApiProperty({ type: Object })
  changes: Record<string, any>;
}

export class UserDeletedEventDto {
  @ApiProperty({ enum: EventType, default: EventType.USER_DELETED })
  type: EventType.USER_DELETED;

  @ApiProperty({ type: String })
  userId: string;

  @ApiProperty({ type: String })
  deletedAt: string;
}

export class ProjectCreatedEventDto {
  @ApiProperty({ enum: EventType, default: EventType.PROJECT_CREATED })
  type: EventType.PROJECT_CREATED;

  @ApiProperty({ type: String })
  projectId: string;

  @ApiProperty({ type: String })
  projectName: string;

  @ApiProperty({ type: String })
  ownerId: string;
}

export class ProjectArchivedEventDto {
  @ApiProperty({ enum: EventType, default: EventType.PROJECT_ARCHIVED })
  type: EventType.PROJECT_ARCHIVED;

  @ApiProperty({ type: String })
  projectId: string;

  @ApiProperty({ type: String })
  archivedAt: string;

  @ApiProperty({ type: String })
  archivedBy: string;
}

export type EventDto =
  | UserCreatedEventDto
  | UserUpdatedEventDto
  | UserDeletedEventDto
  | ProjectCreatedEventDto
  | ProjectArchivedEventDto;

// Animal hierarchy
export enum AnimalType {
  CAT = 'cat',
  DOG = 'dog',
  BIRD = 'bird',
}

export class CatDto {
  @ApiProperty({ enum: AnimalType, default: AnimalType.CAT })
  type: AnimalType.CAT;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: Number })
  livesRemaining: number;

  @ApiProperty({ type: Boolean })
  likesLasagna: boolean;
}

export class DogDto {
  @ApiProperty({ enum: AnimalType, default: AnimalType.DOG })
  type: AnimalType.DOG;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  breed: string;

  @ApiProperty({ type: Boolean })
  isGoodBoy: boolean;
}

export class BirdDto {
  @ApiProperty({ enum: AnimalType, default: AnimalType.BIRD })
  type: AnimalType.BIRD;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: Number })
  wingSpan: number;

  @ApiProperty({ type: Boolean })
  canFly: boolean;
}

export type AnimalDto = CatDto | DogDto | BirdDto;

// Response with union
export class PaymentResponseDto {
  @ApiProperty({ type: String })
  transactionId: string;

  @ApiProperty({ type: String })
  status: string;

  @ApiProperty({
    type: Object,
    description: 'Payment method details (discriminated by type field)',
  })
  paymentMethod: PaymentMethodDto;
}

// Array of polymorphic items
export class EventListDto {
  @ApiProperty({
    type: [Object],
    description: 'Array of events (discriminated by type field)',
  })
  events: EventDto[];
}

export class AnimalListDto {
  @ApiProperty({
    type: [Object],
    description: 'Array of animals (discriminated by type field)',
  })
  animals: AnimalDto[];
}

@ApiTags('polymorphism')
@Controller('polymorphism')
export class PolymorphismController {
  // allOf - inheritance
  @Get('inheritance/base')
  @ApiOperation({ summary: 'Get base entity (allOf pattern)' })
  @ApiResponse({ status: 200, type: BaseEntityDto })
  getBaseEntity(): BaseEntityDto {
    return {
      id: '1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  @Get('inheritance/extended')
  @ApiOperation({ summary: 'Get extended entity (allOf pattern)' })
  @ApiResponse({ status: 200, type: ExtendedEntityDto })
  getExtendedEntity(): ExtendedEntityDto {
    return {
      id: '2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: 'Extended Entity',
      description: 'This extends BaseEntityDto',
    };
  }

  @Get('inheritance/fully-extended')
  @ApiOperation({ summary: 'Get fully extended entity (multiple allOf levels)' })
  @ApiResponse({ status: 200, type: FullyExtendedEntityDto })
  getFullyExtendedEntity(): FullyExtendedEntityDto {
    return {
      id: '3',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: 'Fully Extended Entity',
      description: 'This extends ExtendedEntityDto',
      tags: ['tag1', 'tag2'],
      category: 'example',
    };
  }

  // oneOf with discriminator - payment methods
  @Post('payment/card')
  @ApiOperation({ summary: 'Process card payment (oneOf with discriminator)' })
  @ApiResponse({ status: 200, type: PaymentResponseDto })
  processCardPayment(@Body() payment: CardPaymentDto): PaymentResponseDto {
    return {
      transactionId: 'txn-123',
      status: 'success',
      paymentMethod: payment,
    };
  }

  @Post('payment/bank')
  @ApiOperation({ summary: 'Process bank account payment (oneOf with discriminator)' })
  @ApiResponse({ status: 200, type: PaymentResponseDto })
  processBankPayment(@Body() payment: BankAccountPaymentDto): PaymentResponseDto {
    return {
      transactionId: 'txn-456',
      status: 'success',
      paymentMethod: payment,
    };
  }

  @Post('payment/paypal')
  @ApiOperation({ summary: 'Process PayPal payment (oneOf with discriminator)' })
  @ApiResponse({ status: 200, type: PaymentResponseDto })
  processPayPalPayment(@Body() payment: PayPalPaymentDto): PaymentResponseDto {
    return {
      transactionId: 'txn-789',
      status: 'success',
      paymentMethod: payment,
    };
  }

  // Events - discriminated union
  @Post('event/user-created')
  @ApiOperation({ summary: 'Emit user created event' })
  @ApiResponse({ status: 200, type: UserCreatedEventDto })
  emitUserCreatedEvent(@Body() event: UserCreatedEventDto): UserCreatedEventDto {
    return event;
  }

  @Post('event/user-updated')
  @ApiOperation({ summary: 'Emit user updated event' })
  @ApiResponse({ status: 200, type: UserUpdatedEventDto })
  emitUserUpdatedEvent(@Body() event: UserUpdatedEventDto): UserUpdatedEventDto {
    return event;
  }

  @Post('event/user-deleted')
  @ApiOperation({ summary: 'Emit user deleted event' })
  @ApiResponse({ status: 200, type: UserDeletedEventDto })
  emitUserDeletedEvent(@Body() event: UserDeletedEventDto): UserDeletedEventDto {
    return event;
  }

  @Get('events/list')
  @ApiOperation({ summary: 'Get list of polymorphic events' })
  @ApiResponse({ status: 200, type: EventListDto })
  getEventsList(): EventListDto {
    return {
      events: [
        {
          type: EventType.USER_CREATED,
          userId: 'user-1',
          userName: 'John Doe',
          email: 'john@example.com',
        },
        {
          type: EventType.PROJECT_CREATED,
          projectId: 'proj-1',
          projectName: 'My Project',
          ownerId: 'user-1',
        },
      ],
    };
  }

  // Animals - another discriminated union
  @Post('animal/cat')
  @ApiOperation({ summary: 'Create a cat' })
  @ApiResponse({ status: 200, type: CatDto })
  createCat(@Body() cat: CatDto): CatDto {
    return cat;
  }

  @Post('animal/dog')
  @ApiOperation({ summary: 'Create a dog' })
  @ApiResponse({ status: 200, type: DogDto })
  createDog(@Body() dog: DogDto): DogDto {
    return dog;
  }

  @Post('animal/bird')
  @ApiOperation({ summary: 'Create a bird' })
  @ApiResponse({ status: 200, type: BirdDto })
  createBird(@Body() bird: BirdDto): BirdDto {
    return bird;
  }

  @Get('animals/list')
  @ApiOperation({ summary: 'Get list of polymorphic animals' })
  @ApiResponse({ status: 200, type: AnimalListDto })
  getAnimalsList(): AnimalListDto {
    return {
      animals: [
        { type: AnimalType.CAT, name: 'Garfield', livesRemaining: 7, likesLasagna: true },
        { type: AnimalType.DOG, name: 'Buddy', breed: 'Golden Retriever', isGoodBoy: true },
        { type: AnimalType.BIRD, name: 'Tweety', wingSpan: 20, canFly: true },
      ],
    };
  }
}
